from __future__ import annotations

import os
import json
import logging
import shutil
import zipfile
from typing import TYPE_CHECKING
from urllib.parse import urlparse

import aiohttp
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, HttpUrl

import db
from plugin_manager import PluginManager # Assuming plugin_manager.py is in the same directory or accessible

if TYPE_CHECKING:
    from bot import SparkSageBot

logger = logging.getLogger("sparksage.api")
router = APIRouter()

# This will be set by main.py during startup
plugin_manager: PluginManager | None = None
bot_instance: SparkSageBot | None = None

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

@router.on_event("startup")
async def startup_event():
    global plugin_manager, bot_instance
    from api.main import get_bot_instance
    bot_instance = get_bot_instance()
    if bot_instance:
        plugin_manager = PluginManager(bot_instance)
        await plugin_manager.scan_plugins()
        await plugin_manager.load_enabled_plugins()
    else:
        logger.warning("Bot instance not available at API startup. Plugin manager will not be initialized.")

@router.get("/plugins", response_model=list[PluginManifest])
async def list_plugins():
    """List all available plugins with their current status."""
    if plugin_manager is None:
        raise HTTPException(status_code=500, detail="Plugin manager not initialized.")
    
    db_plugins = await db.get_plugins()
    plugins = []
    for p in db_plugins:
        # Check if the plugin is actually loaded in the bot
        loaded = False
        try:
            folder_path = os.path.join(plugin_manager.plugins_dir, p["id"])
            manifest_path = os.path.join(folder_path, "manifest.json")
            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest = json.load(f)
            cog_filename = manifest.get("cog")
            if cog_filename:
                module_name = cog_filename.replace(".py", "")
                extension_path = f"plugins.{p['id']}.{module_name}"
                loaded = extension_path in plugin_manager.bot.extensions
        except Exception:
            loaded = False # Manifest or cog file might be corrupt/missing

        plugins.append(PluginManifest(
            id=p["id"],
            name=p["name"],
            version=p["version"],
            author=p["author"],
            description=p["description"],
            cog="", # cog is not stored in DB, so we omit it for list
            enabled=bool(p["enabled"]), # Add enabled status
            loaded=loaded # Add loaded status
        ))
    return plugins

@router.post("/plugins/{plugin_id}/enable")
async def enable_plugin(plugin_id: str):
    """Enable a specific plugin."""
    if plugin_manager is None:
        raise HTTPException(status_code=500, detail="Plugin manager not initialized.")
    
    success, message = await plugin_manager.load_plugin(plugin_id)
    if not success:
        raise HTTPException(status_code=400, detail=f"Failed to enable plugin: {message}")
    
    return {"message": f"Plugin {plugin_id} enabled successfully."}

@router.post("/plugins/{plugin_id}/disable")
async def disable_plugin(plugin_id: str):
    """Disable a specific plugin."""
    if plugin_manager is None:
        raise HTTPException(status_code=500, detail="Plugin manager not initialized.")
    
    success, message = await plugin_manager.unload_plugin(plugin_id)
    if not success:
        raise HTTPException(status_code=400, detail=f"Failed to disable plugin: {message}")
    
    return {"message": f"Plugin {plugin_id} disabled successfully."}

@router.post("/plugins/install")
async def install_plugin(request: PluginInstallRequest, background_tasks: BackgroundTasks):
    """Install a new plugin from a URL."""
    if plugin_manager is None:
        raise HTTPException(status_code=500, detail="Plugin manager not initialized.")
    
    # Simple validation for now: expect a zip file.
    if not request.url.path.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Only zip file installations are supported for now.")

    background_tasks.add_task(_install_plugin_from_url, request.url, plugin_manager)
    return {"message": "Plugin installation initiated in background."}

async def _install_plugin_from_url(url: HttpUrl, manager: PluginManager):
    logger.info(f"Starting plugin installation from {url}")
    try:
        async with aiohttp.ClientSession() as session:
            async with session.get(str(url)) as response:
                response.raise_for_status()
                # Create a temporary file to save the zip
                temp_zip_path = os.path.join(manager.plugins_dir, "temp_plugin.zip")
                with open(temp_zip_path, "wb") as f:
                    while True:
                        chunk = await response.content.read(1024)
                        if not chunk:
                            break
                        f.write(chunk)
                
                # Extract the zip file
                with zipfile.ZipFile(temp_zip_path, 'r') as zip_ref:
                    # Assuming the zip contains a single root folder for the plugin
                    # We'll need to be careful with security here in a real app
                    # For now, let's just extract to the plugins directory and hope for the best
                    # TODO: Add more robust validation and security checks for plugin zips
                    zip_ref.extractall(manager.plugins_dir)
                
                # Find the newly extracted plugin folder (this is a simple heuristic)
                extracted_folder = None
                for name in os.listdir(manager.plugins_dir):
                    if os.path.isdir(os.path.join(manager.plugins_dir, name)) and name != "temp_plugin.zip" and name != "trivia": # Exclude existing and temp
                        # Further check for manifest.json
                        if os.path.exists(os.path.join(manager.plugins_dir, name, "manifest.json")):
                            extracted_folder = name
                            break
                
                if not extracted_folder:
                    raise Exception("Could not find extracted plugin folder with manifest.json")

                # Clean up the temporary zip file
                os.remove(temp_zip_path)

                # Sync the new plugin with the database
                await manager.scan_plugins()
                logger.info(f"Plugin {extracted_folder} installed and synced with DB.")
                
                # Load the plugin if it's new and enabled by default (or as per manifest)
                # For now, let's assume newly installed plugins should be enabled if not already
                db_plugin = await db.get_plugins()
                new_plugin_data = next((p for p in db_plugin if p["id"] == extracted_folder), None)
                
                if new_plugin_data and not new_plugin_data["enabled"]:
                    logger.info(f"Enabling newly installed plugin: {extracted_folder}")
                    await manager.load_plugin(extracted_folder)

                logger.info(f"Successfully installed plugin from {url}")

    except Exception as e:
        logger.error(f"Error installing plugin from {url}: {e}")
        if os.path.exists(temp_zip_path):
            os.remove(temp_zip_path)
        # Attempt to clean up partially extracted folders if possible
        # This is tricky and might need more sophisticated rollback
        if 'extracted_folder' in locals() and os.path.exists(os.path.join(manager.plugins_dir, extracted_folder)):
            shutil.rmtree(os.path.join(manager.plugins_dir, extracted_folder))
