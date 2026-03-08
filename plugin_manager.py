from __future__ import annotations

import os
import json
import logging
import traceback
import sys
import re
from typing import TYPE_CHECKING
import db
import asyncio # Added this import

if TYPE_CHECKING:
    from bot import SparkSageBot

logger = logging.getLogger("sparksage.plugins")

class PluginManager:
    def __init__(self, bot: SparkSageBot):
        self.bot = bot
        # Ensure plugins_dir is absolute and points to the sparksage/plugins folder
        self.plugins_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "plugins"))
        
        # Add the parent directory of 'plugins' to sys.path if it's not already there
        # to ensure relative imports like 'plugins.trivia.trivia_cog' work correctly
        sparksage_root = os.path.dirname(__file__)
        if sparksage_root not in sys.path:
            sys.path.insert(0, sparksage_root)

    def _manifest_path(self, plugin_id: str) -> str:
        return os.path.join(self.plugins_dir, plugin_id, "manifest.json")

    def _read_manifest(self, plugin_id: str) -> dict | None:
        manifest_path = self._manifest_path(plugin_id)
        if not os.path.exists(manifest_path):
            return None
        with open(manifest_path, "r", encoding="utf-8") as f:
            return json.load(f)

    @staticmethod
    def _slugify(text: str) -> str:
        value = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
        return value

    @staticmethod
    def _acronym(text: str) -> str:
        words = [w for w in re.split(r"[^A-Za-z0-9]+", text) if w]
        return "".join(w[0].lower() for w in words)

    async def _resolve_plugin_id(self, plugin_id: str) -> tuple[str | None, dict | None]:
        """Resolve a requested plugin ID to an actual plugin folder ID and manifest.

        Supports stale IDs by matching against manifest name variants (slug/acronym),
        e.g. "qotd" -> folder "quote_of_the_day".
        """
        # 1) Direct ID lookup
        direct_manifest = self._read_manifest(plugin_id)
        if direct_manifest is not None:
            return plugin_id, direct_manifest

        normalized_target = plugin_id.lower().replace("-", "_")
        wanted_name: str | None = None
        try:
            plugins = await db.get_plugins()
            row = next((p for p in plugins if p["id"] == plugin_id), None)
            if row:
                wanted_name = (row.get("name") or "").strip().lower()
        except Exception:
            wanted_name = None

        # 2) Fallback: scan all manifests and match by known aliases.
        for folder_name in os.listdir(self.plugins_dir):
            if folder_name.startswith("__") or folder_name.startswith("."):
                continue

            folder_path = os.path.join(self.plugins_dir, folder_name)
            if not os.path.isdir(folder_path):
                continue

            manifest = self._read_manifest(folder_name)
            if manifest is None:
                continue

            plugin_name = str(manifest.get("name") or "")
            aliases = {
                folder_name.lower(),
                folder_name.lower().replace("-", "_"),
            }
            if plugin_name:
                aliases.add(self._slugify(plugin_name))
                aliases.add(self._acronym(plugin_name))

            if normalized_target in aliases:
                return folder_name, manifest

            if wanted_name and plugin_name.strip().lower() == wanted_name:
                return folder_name, manifest

        return None, None

    async def sync_commands(self, guild_id: int | None = None) -> tuple[bool, str]:
        """Sync slash commands globally or to a specific guild."""
        if self.bot is None:
            logger.error("Bot instance is None, cannot sync commands.")
            print("❌ Bot instance is None, cannot sync commands.")
            return False, "Bot instance is None, cannot sync commands."

        if self.bot.tree is None:
            logger.error("Bot command tree is None, cannot sync commands.")
            print("❌ Bot command tree is None, cannot sync commands.")
            return False, "Bot command tree is None, cannot sync commands."

        try:
            print(f"DEBUG: In sync_commands, self.bot: {self.bot}")
            print(f"DEBUG: In sync_commands, self.bot.tree: {self.bot.tree}")

            # Schedule the bot's sync helper to run on the bot's event loop.
            # We must run discord.py calls on the bot's loop rather than the API server
            # loop to avoid "Timeout context manager should be used inside a task" errors.
            try:
                fut = asyncio.run_coroutine_threadsafe(self.bot._sync_commands_on_loop(guild_id), self.bot.loop)
                # Convert concurrent.futures.Future into an awaitable asyncio.Future
                success, message = await asyncio.wrap_future(fut)
            except Exception as e:
                print(f"❌ Exception while scheduling sync on bot loop: {e}")
                raise

            if success:
                logger.info(f"Synced commands (guild_id: {guild_id})")
                print(f"✅ Synced commands (guild_id: {guild_id})")
                return True, ""
            else:
                logger.error(f"Failed to sync commands (guild_id: {guild_id}): {message}")
                print(f"❌ Failed to sync commands (guild_id: {guild_id}): {message}")
                return False, message
        except Exception as e:
            logger.error(f"Failed to sync commands: {e}")
            print(f"❌ Failed to sync commands: {e}")
            return False, str(e)


    async def scan_plugins(self):
        """Scan the plugins directory and sync with the database."""
        if not os.path.exists(self.plugins_dir):
            os.makedirs(self.plugins_dir)

        for folder_name in os.listdir(self.plugins_dir):
            if folder_name.startswith("__") or folder_name.startswith("."):
                continue
                
            folder_path = os.path.join(self.plugins_dir, folder_name)
            if not os.path.isdir(folder_path):
                continue

            manifest_path = os.path.join(folder_path, "manifest.json")
            if not os.path.exists(manifest_path):
                continue

            try:
                with open(manifest_path, "r", encoding="utf-8") as f:
                    manifest = json.load(f)
                
                manifest["id"] = folder_name
                if "name" not in manifest:
                    manifest["name"] = folder_name
                
                await db.sync_plugin(manifest)
                logger.info(f"Synced plugin metadata: {manifest['name']}")
            except Exception as e:
                logger.error(f"Error loading manifest for {folder_name}: {e}")

    async def load_enabled_plugins(self):
        """Load all plugins that are marked as enabled in the database."""
        plugins = await db.get_plugins()
        for p in plugins:
            if p["enabled"]:
                print(f"Enabling plugin on startup: {p['id']}")
                await self.load_plugin(p["id"])

    async def load_plugin(self, plugin_id: str) -> tuple[bool, str]:
        """Load or reload a specific plugin by ID."""
        resolved_id, manifest = await self._resolve_plugin_id(plugin_id)
        if resolved_id is None or manifest is None:
            print(f"❌ Manifest not found for plugin: {plugin_id}")
            return False, f"Manifest not found for plugin: {plugin_id}"

        try:
            cog_filename = manifest.get("cog")
            if not cog_filename:
                print(f"❌ Plugin {resolved_id} manifest missing 'cog' field.")
                return False, f"Plugin {resolved_id} manifest missing 'cog' field."

            module_name = cog_filename.replace(".py", "")
            # The extension path needs to be relative to the sparksage root
            extension_path = f"plugins.{resolved_id}.{module_name}"

            # Always try to unload first if it's currently loaded
            if extension_path in self.bot.extensions:
                try:
                    print(f"📤 Unloading plugin for reload: {plugin_id} ({extension_path})")
                    await self.bot.unload_extension(extension_path)
                except Exception as e:
                    # Log the error but don't prevent loading if unload fails for some reason
                    logger.warning(f"Failed to unload plugin {plugin_id} during reload attempt: {e}")
                    print(f"⚠️ Warning: Failed to unload plugin {plugin_id} during reload: {e}")

            print(f"📥 Loading plugin: {resolved_id} ({extension_path})")
            await self.bot.load_extension(extension_path)
            print(f"DEBUG: Attempting to sync commands after loading {resolved_id}")
            result, message = await self.sync_commands()
            if not result:
                print(f"❌ Error syncing commands for {resolved_id}: {message}")
            else:
                print(f"✅ Successfully synced commands for {resolved_id}")
            
            await db.set_plugin_state(plugin_id, True)
            if resolved_id != plugin_id:
                await db.set_plugin_state(resolved_id, True)
            print(f"✅ Successfully loaded/reloaded: {resolved_id}")
            return True, ""
        except Exception as e:
            print(f"❌ ERROR loading plugin {plugin_id}:")
            full_traceback = traceback.format_exc()
            print(full_traceback)
            return False, full_traceback

    async def unload_plugin(self, plugin_id: str) -> tuple[bool, str]:
        """Unload a specific plugin by ID."""
        resolved_id, manifest = await self._resolve_plugin_id(plugin_id)
        
        try:
            if resolved_id is None or manifest is None:
                # If plugin files are missing, still persist disabled state.
                await db.set_plugin_state(plugin_id, False)
                return True, ""

            cog_filename = manifest.get("cog")
            if not isinstance(cog_filename, str) or not cog_filename.strip():
                # Some manually deployed plugins may have incomplete manifests.
                # Disabling should still work by updating persistent plugin state.
                await db.set_plugin_state(plugin_id, False)
                if resolved_id != plugin_id:
                    await db.set_plugin_state(resolved_id, False)
                return True, ""

            module_name = cog_filename.replace(".py", "")
            extension_path = f"plugins.{resolved_id}.{module_name}"

            if extension_path in self.bot.extensions:
                print(f"📤 Unloading plugin: {resolved_id}")
                await self.bot.unload_extension(extension_path)
                print(f"✅ Successfully unloaded: {resolved_id}")

            # Persist disabled state even when extension was not currently loaded.
            await db.set_plugin_state(plugin_id, False)
            if resolved_id != plugin_id:
                await db.set_plugin_state(resolved_id, False)
            return True, ""
        except Exception as e:
            print(f"❌ ERROR unloading plugin {plugin_id}:")
            full_traceback = traceback.format_exc()
            print(full_traceback)
            return False, full_traceback

    async def reload_plugin(self, plugin_id: str) -> tuple[bool, str]:
        """Reload a specific plugin."""
        return await self.load_plugin(plugin_id)
