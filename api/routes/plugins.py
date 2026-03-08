from __future__ import annotations

import json
import logging
import os
import re
import shutil
import tempfile
import zipfile
from pathlib import Path, PurePosixPath
from typing import TYPE_CHECKING

import httpx
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, HttpUrl

import db
from plugin_manager import PluginManager

if TYPE_CHECKING:
    from bot import SparkSageBot

logger = logging.getLogger("sparksage.api")
router = APIRouter()

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
SAFE_PLUGIN_ID_RE = re.compile(r"^[A-Za-z0-9_-]+$")

# This will be set by main.py during startup
plugin_manager: PluginManager | None = None
bot_instance: SparkSageBot | None = None


async def _ensure_plugin_manager(require_bot: bool = False) -> PluginManager:
    """Initialize plugin manager on-demand.

    - require_bot=False: allows filesystem/db plugin operations (list/upload/install)
    - require_bot=True: requires an attached, running bot for load/unload/sync
    """
    global plugin_manager, bot_instance

    from api.main import get_bot_instance

    bot_instance = get_bot_instance()

    if plugin_manager is None:
        # For upload/list we can operate without a bot by scanning plugin files only.
        plugin_manager = PluginManager(bot_instance)
        await plugin_manager.scan_plugins()
    elif plugin_manager.bot is None and bot_instance is not None:
        # Bot became available after API startup; attach it to existing manager.
        plugin_manager.bot = bot_instance

    if require_bot and plugin_manager.bot is None:
        raise HTTPException(
            status_code=503,
            detail="Discord bot is not running yet. Start the bot and try again.",
        )

    return plugin_manager

class PluginManifest(BaseModel):
    id: str
    name: str
    version: str | None = None
    author: str | None = None
    description: str | None = None
    cog: str | None = None # cog is optional as it's not always returned
    enabled: bool
    loaded: bool

class PluginInstallRequest(BaseModel):
    url: HttpUrl


class PluginToggleRequest(BaseModel):
    id: str
    enabled: bool


class PluginListResponse(BaseModel):
    plugins: list[PluginManifest]


class PluginInstallResponse(BaseModel):
    message: str
    plugin_id: str
    plugin_name: str


class PluginInstallError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def _normalize_zip_name(name: str) -> str:
    return name.replace("\\", "/")


def _is_safe_zip_member(path: PurePosixPath) -> bool:
    if path.is_absolute() or len(path.parts) == 0:
        return False
    if any(part in ("", ".", "..") for part in path.parts):
        return False
    # Reject Windows drive prefixes, e.g. C:/...
    if ":" in path.parts[0]:
        return False
    return True


def _ensure_not_symlink(info: zipfile.ZipInfo):
    mode = (info.external_attr >> 16) & 0o170000
    if mode == 0o120000:
        raise PluginInstallError(
            f"Archive contains unsupported symlink entry: {info.filename}",
            status_code=400,
        )


async def _parse_plugin_archive(zip_path: Path) -> tuple[str, dict]:
    try:
        with zipfile.ZipFile(zip_path, "r") as archive:
            infos = archive.infolist()
            if not infos:
                raise PluginInstallError("Uploaded archive is empty.")

            manifest_roots: set[str] = set()
            member_names: set[str] = set()

            for info in infos:
                _ensure_not_symlink(info)
                normalized = _normalize_zip_name(info.filename)
                member_path = PurePosixPath(normalized)
                if not _is_safe_zip_member(member_path):
                    raise PluginInstallError(
                        f"Archive contains an unsafe path: {info.filename}",
                        status_code=400,
                    )
                if info.is_dir():
                    continue

                member_names.add(member_path.as_posix())
                if member_path.name == "manifest.json" and len(member_path.parts) >= 2:
                    manifest_roots.add(member_path.parts[0])

            if len(manifest_roots) != 1:
                raise PluginInstallError(
                    "Archive must contain exactly one plugin folder with a manifest.json file.",
                    status_code=400,
                )

            plugin_id = next(iter(manifest_roots))
            if not SAFE_PLUGIN_ID_RE.match(plugin_id):
                raise PluginInstallError(
                    "Plugin folder name must use only letters, numbers, hyphens, or underscores.",
                    status_code=400,
                )

            manifest_member = f"{plugin_id}/manifest.json"
            if manifest_member not in member_names:
                raise PluginInstallError("Plugin manifest.json was not found in the plugin root folder.")

            try:
                with archive.open(manifest_member, "r") as manifest_file:
                    manifest = json.load(manifest_file)
            except json.JSONDecodeError as exc:
                raise PluginInstallError(f"manifest.json is not valid JSON: {exc}") from exc

            if not isinstance(manifest, dict):
                raise PluginInstallError("manifest.json must be a JSON object.")

            cog = manifest.get("cog")
            if not isinstance(cog, str) or not cog.strip():
                raise PluginInstallError("manifest.json is missing required 'cog' field.")

            cog_path = PurePosixPath(cog)
            if cog_path.is_absolute() or ".." in cog_path.parts or len(cog_path.parts) == 0:
                raise PluginInstallError("manifest.json contains an invalid 'cog' path.")

            expected_cog_path = f"{plugin_id}/{cog_path.as_posix()}"
            if expected_cog_path not in member_names:
                raise PluginInstallError(
                    f"Cog file referenced by manifest was not found: {cog}",
                    status_code=400,
                )

            return plugin_id, manifest
    except zipfile.BadZipFile as exc:
        raise PluginInstallError("Uploaded file is not a valid zip archive.", status_code=400) from exc


def _extract_archive_safely(zip_path: Path, destination: Path):
    with zipfile.ZipFile(zip_path, "r") as archive:
        for info in archive.infolist():
            _ensure_not_symlink(info)
            member_path = PurePosixPath(_normalize_zip_name(info.filename))
            if not _is_safe_zip_member(member_path):
                raise PluginInstallError(
                    f"Archive contains an unsafe path: {info.filename}",
                    status_code=400,
                )

            target_path = destination.joinpath(*member_path.parts)
            if info.is_dir():
                target_path.mkdir(parents=True, exist_ok=True)
                continue

            target_path.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(info, "r") as src, open(target_path, "wb") as dst:
                shutil.copyfileobj(src, dst)


async def _install_plugin_zip(zip_path: Path, manager: PluginManager) -> tuple[str, str]:
    plugin_id, manifest = await _parse_plugin_archive(zip_path)

    plugins_dir = Path(manager.plugins_dir)
    target_dir = plugins_dir / plugin_id
    if target_dir.exists():
        raise PluginInstallError(f"Plugin '{plugin_id}' is already installed.", status_code=409)

    installed_dir: Path | None = None
    try:
        with tempfile.TemporaryDirectory(prefix="plugin_unpack_") as temp_dir:
            temp_root = Path(temp_dir)
            _extract_archive_safely(zip_path, temp_root)

            extracted_plugin_dir = temp_root / plugin_id
            if not extracted_plugin_dir.is_dir():
                raise PluginInstallError("Extracted archive is missing the plugin root folder.")

            shutil.move(str(extracted_plugin_dir), str(target_dir))
            installed_dir = target_dir

        await manager.scan_plugins()

        known_plugins = await db.get_plugins()
        plugin_row = next((p for p in known_plugins if p["id"] == plugin_id), None)
        if plugin_row is None:
            raise PluginInstallError("Plugin metadata could not be registered after installation.")

        plugin_name = plugin_row.get("name") or manifest.get("name") or plugin_id
        return plugin_id, plugin_name
    except PluginInstallError:
        if installed_dir and installed_dir.exists():
            shutil.rmtree(installed_dir, ignore_errors=True)
        raise
    except Exception as exc:
        if installed_dir and installed_dir.exists():
            shutil.rmtree(installed_dir, ignore_errors=True)
        raise PluginInstallError(f"Unexpected installation error: {exc}", status_code=500) from exc


async def _collect_plugins() -> list[PluginManifest]:
    manager = await _ensure_plugin_manager(require_bot=False)
    await manager.scan_plugins()
    db_plugins = await db.get_plugins()
    plugins: list[PluginManifest] = []

    for p in db_plugins:
        loaded = False
        if plugin_manager is not None and plugin_manager.bot is not None:
            try:
                folder_path = os.path.join(plugin_manager.plugins_dir, p["id"])
                manifest_path = os.path.join(folder_path, "manifest.json")
                with open(manifest_path, "r", encoding="utf-8") as file:
                    manifest = json.load(file)
                cog_filename = manifest.get("cog")
                if cog_filename:
                    module_name = cog_filename.replace(".py", "")
                    extension_path = f"plugins.{p['id']}.{module_name}"
                    loaded = extension_path in plugin_manager.bot.extensions
            except Exception:
                loaded = False

        plugins.append(
            PluginManifest(
                id=p["id"],
                name=p["name"],
                version=p["version"],
                author=p["author"],
                description=p["description"],
                cog="",
                enabled=bool(p["enabled"]),
                loaded=loaded,
            )
        )

    return plugins

@router.on_event("startup")
async def startup_event():
    global plugin_manager, bot_instance
    try:
        manager = await _ensure_plugin_manager(require_bot=False)
        if manager.bot is not None:
            await manager.load_enabled_plugins()
    except HTTPException:
        logger.warning("Bot instance not available at API startup. Plugin manager will be initialized lazily.")

@router.get("", response_model=PluginListResponse)
async def list_plugins():
    """List plugins (dashboard response shape)."""
    return PluginListResponse(plugins=await _collect_plugins())


@router.get("/plugins", response_model=list[PluginManifest])
async def list_plugins_legacy():
    """Legacy list route retained for backward compatibility."""
    return await _collect_plugins()

@router.post("/plugins/{plugin_id}/enable")
async def enable_plugin(plugin_id: str):
    """Enable a specific plugin."""
    manager = await _ensure_plugin_manager(require_bot=True)
    
    success, message = await manager.load_plugin(plugin_id)
    if not success:
        raise HTTPException(status_code=400, detail=f"Failed to enable plugin: {message}")
    
    return {"message": f"Plugin {plugin_id} enabled successfully."}


@router.post("/toggle")
async def toggle_plugin(request: PluginToggleRequest):
    """Toggle plugin enabled state (dashboard endpoint)."""
    manager = await _ensure_plugin_manager(require_bot=True)

    if request.enabled:
        success, message = await manager.load_plugin(request.id)
        if not success:
            raise HTTPException(status_code=400, detail=f"Failed to enable plugin: {message}")
    else:
        success, message = await manager.unload_plugin(request.id)
        if not success:
            raise HTTPException(status_code=400, detail=f"Failed to disable plugin: {message}")

    return {"status": "ok", "enabled": request.enabled}

@router.post("/plugins/{plugin_id}/disable")
async def disable_plugin(plugin_id: str):
    """Disable a specific plugin."""
    manager = await _ensure_plugin_manager(require_bot=True)
    
    success, message = await manager.unload_plugin(plugin_id)
    if not success:
        raise HTTPException(status_code=400, detail=f"Failed to disable plugin: {message}")
    
    return {"message": f"Plugin {plugin_id} disabled successfully."}


@router.post("/{plugin_id}/reload")
async def reload_plugin(plugin_id: str):
    """Reload a specific plugin (dashboard endpoint)."""
    manager = await _ensure_plugin_manager(require_bot=True)

    success, message = await manager.reload_plugin(plugin_id)
    if not success:
        raise HTTPException(status_code=400, detail=f"Failed to reload plugin: {message}")

    return {"status": "ok"}


@router.post("/sync")
async def sync_plugins():
    """Sync application commands after plugin changes (dashboard endpoint)."""
    manager = await _ensure_plugin_manager(require_bot=True)

    success, message = await manager.sync_commands()
    if not success:
        raise HTTPException(status_code=400, detail=f"Failed to sync commands: {message}")

    return {"status": "ok"}

@router.post("/upload", response_model=PluginInstallResponse)
async def upload_plugin(file: UploadFile = File(...)):
    """Upload and install a plugin zip file."""
    manager = await _ensure_plugin_manager(require_bot=False)

    filename = file.filename or ""
    if not filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip plugin archives are supported.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as temp_file:
        temp_zip_path = Path(temp_file.name)

    size = 0
    try:
        while True:
            chunk = await file.read(1024 * 1024)
            if not chunk:
                break

            size += len(chunk)
            if size > MAX_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=f"Plugin archive is too large. Maximum size is {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
                )

            with open(temp_zip_path, "ab") as handle:
                handle.write(chunk)

        plugin_id, plugin_name = await _install_plugin_zip(temp_zip_path, manager)
        return PluginInstallResponse(
            message=f"Plugin '{plugin_name}' installed successfully. Enable it to start using it.",
            plugin_id=plugin_id,
            plugin_name=plugin_name,
        )
    except PluginInstallError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    finally:
        await file.close()
        if temp_zip_path.exists():
            temp_zip_path.unlink(missing_ok=True)


@router.post("/install", response_model=PluginInstallResponse)
async def install_plugin(request: PluginInstallRequest):
    """Install a plugin from a direct zip URL (legacy helper endpoint)."""
    manager = await _ensure_plugin_manager(require_bot=False)

    if not str(request.url).lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only .zip plugin archives are supported.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".zip") as temp_file:
        temp_zip_path = Path(temp_file.name)

    try:
        async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
            response = await client.get(str(request.url))
            response.raise_for_status()

            content = response.content
            if len(content) > MAX_UPLOAD_BYTES:
                raise HTTPException(
                    status_code=413,
                    detail=f"Plugin archive is too large. Maximum size is {MAX_UPLOAD_BYTES // (1024 * 1024)} MB.",
                )

            with open(temp_zip_path, "wb") as handle:
                handle.write(content)

        plugin_id, plugin_name = await _install_plugin_zip(temp_zip_path, manager)
        return PluginInstallResponse(
            message=f"Plugin '{plugin_name}' installed successfully. Enable it to start using it.",
            plugin_id=plugin_id,
            plugin_name=plugin_name,
        )
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=400, detail=f"Failed to download plugin archive: {exc}") from exc
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=400, detail=f"Error fetching plugin archive: {exc}") from exc
    except PluginInstallError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc
    finally:
        if temp_zip_path.exists():
            temp_zip_path.unlink(missing_ok=True)


@router.delete("/{plugin_id}")
async def delete_plugin(plugin_id: str):
    """Remove an installed plugin from disk and metadata."""
    manager = await _ensure_plugin_manager(require_bot=False)

    if not SAFE_PLUGIN_ID_RE.match(plugin_id):
        raise HTTPException(status_code=400, detail="Invalid plugin id.")

    resolved_id, manifest = await manager._resolve_plugin_id(plugin_id)
    target_id = resolved_id or plugin_id
    target_dir = Path(manager.plugins_dir) / target_id

    if resolved_id is None and not target_dir.exists():
        known_plugins = await db.get_plugins()
        if not any(p["id"] == plugin_id for p in known_plugins):
            raise HTTPException(status_code=404, detail=f"Plugin '{plugin_id}' was not found.")

    # If a bot is attached and plugin is loaded, unload before deletion.
    if manager.bot is not None and resolved_id is not None and manifest is not None:
        success, message = await manager.unload_plugin(plugin_id)
        if not success:
            raise HTTPException(status_code=400, detail=f"Failed to unload plugin before delete: {message}")

    if target_dir.exists() and target_dir.is_dir():
        shutil.rmtree(target_dir, ignore_errors=True)

    # Clean stale metadata and ensure requested id is removed.
    await manager.scan_plugins()
    await db.delete_plugin(plugin_id)
    if resolved_id and resolved_id != plugin_id:
        await db.delete_plugin(resolved_id)

    # Keep command registry in sync when bot is available.
    if manager.bot is not None:
        await manager.sync_commands()

    return {"status": "ok", "plugin_id": target_id}
