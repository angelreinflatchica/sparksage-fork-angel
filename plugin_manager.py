from __future__ import annotations

import os
import json
import logging
import traceback
import sys
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
            
            # Use asyncio.run_coroutine_threadsafe to run the sync on the bot's event loop
            success, message = await self.bot._sync_commands_on_loop(guild_id)

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

    async def load_plugin(self, plugin_id: str) -> bool:
        """Load or reload a specific plugin by ID."""
        folder_path = os.path.join(self.plugins_dir, plugin_id)
        manifest_path = os.path.join(folder_path, "manifest.json")
        
        if not os.path.exists(manifest_path):
            print(f"❌ Manifest not found for plugin: {plugin_id}")
            return False, f"Manifest not found for plugin: {plugin_id}"

        try:
            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest = json.load(f)
            
            cog_filename = manifest.get("cog")
            if not cog_filename:
                print(f"❌ Plugin {plugin_id} manifest missing 'cog' field.")
                return False, f"Plugin {plugin_id} manifest missing 'cog' field."

            module_name = cog_filename.replace(".py", "")
            # The extension path needs to be relative to the sparksage root
            extension_path = f"plugins.{plugin_id}.{module_name}"

            # Always try to unload first if it's currently loaded
            if extension_path in self.bot.extensions:
                try:
                    print(f"📤 Unloading plugin for reload: {plugin_id} ({extension_path})")
                    await self.bot.unload_extension(extension_path)
                except Exception as e:
                    # Log the error but don't prevent loading if unload fails for some reason
                    logger.warning(f"Failed to unload plugin {plugin_id} during reload attempt: {e}")
                    print(f"⚠️ Warning: Failed to unload plugin {plugin_id} during reload: {e}")

            print(f"📥 Loading plugin: {plugin_id} ({extension_path})")
            await self.bot.load_extension(extension_path)
            print(f"DEBUG: Attempting to sync commands after loading {plugin_id}")
            result, message = await self.sync_commands()
            if not result:
                print(f"❌ Error syncing commands for {plugin_id}: {message}")
            else:
                print(f"✅ Successfully synced commands for {plugin_id}")
            
            print(f"✅ Successfully loaded/reloaded: {plugin_id}")
            return True, ""
        except Exception as e:
            print(f"❌ ERROR loading plugin {plugin_id}:")
            full_traceback = traceback.format_exc()
            print(full_traceback)
            return False, full_traceback

    async def unload_plugin(self, plugin_id: str) -> bool:
        """Unload a specific plugin by ID."""
        folder_path = os.path.join(self.plugins_dir, plugin_id)
        manifest_path = os.path.join(folder_path, "manifest.json")
        
        try:
            if not os.path.exists(manifest_path):
                return True

            with open(manifest_path, "r", encoding="utf-8") as f:
                manifest = json.load(f)
            
            cog_filename = manifest.get("cog")
            module_name = cog_filename.replace(".py", "")
            extension_path = f"plugins.{plugin_id}.{module_name}"

            if extension_path in self.bot.extensions:
                print(f"📤 Unloading plugin: {plugin_id}")
                await self.bot.unload_extension(extension_path)
                print(f"✅ Successfully unloaded: {plugin_id}")
            return True, ""
        except Exception as e:
            print(f"❌ ERROR unloading plugin {plugin_id}:")
            full_traceback = traceback.format_exc()
            print(full_traceback)
            return False, full_traceback

    async def reload_plugin(self, plugin_id: str) -> bool:
        """Reload a specific plugin."""
        return await self.load_plugin(plugin_id)
