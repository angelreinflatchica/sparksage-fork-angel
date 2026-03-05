from __future__ import annotations

import discord
from discord import app_commands
from discord.ext import commands
import db
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from bot import SparkSageBot

class PluginCog(commands.Cog):
    def __init__(self, bot: SparkSageBot):
        self.bot = bot

    plugin_group = app_commands.Group(
        name="plugin",
        description="Manage community plugins"
    )

    @plugin_group.command(name="list", description="List all installed plugins")
    async def plugin_list(self, interaction: discord.Interaction):
        plugins = await db.get_plugins()
        if not plugins:
            await interaction.response.send_message("No plugins installed in `plugins/` directory.")
            return

        embed = discord.Embed(title="🧩 Community Plugins", color=discord.Color.blue())
        for p in plugins:
            status = "✅ Enabled" if p["enabled"] else "❌ Disabled"
            desc = p["description"] or "No description provided."
            embed.add_field(
                name=f"{p['name']} v{p['version'] or '1.0.0'}",
                value=f"**Status:** {status}\n**Author:** {p['author'] or 'Unknown'}\n{desc}",
                inline=False
            )
        await interaction.response.send_message(embed=embed)

    @plugin_group.command(name="enable", description="Enable a plugin")
    @app_commands.describe(plugin_id="The folder name of the plugin")
    async def plugin_enable(self, interaction: discord.Interaction, plugin_id: str):
        await interaction.response.defer()
        # Update DB
        await db.set_plugin_state(plugin_id, True)
        # Load in bot
        success = await self.bot.plugin_manager.load_plugin(plugin_id)
        if success:
            # Sync commands to this guild immediately
            await self.bot.plugin_manager.sync_commands(guild_id=interaction.guild_id)
            await interaction.followup.send(f"✅ Plugin `{plugin_id}` enabled and commands synced.")
        else:
            await interaction.followup.send(f"❌ Plugin `{plugin_id}` enabled in settings but failed to load. Check console for traceback.")

    @plugin_group.command(name="disable", description="Disable a plugin")
    @app_commands.describe(plugin_id="The folder name of the plugin")
    async def plugin_disable(self, interaction: discord.Interaction, plugin_id: str):
        await interaction.response.defer()
        # Update DB
        await db.set_plugin_state(plugin_id, False)
        # Unload in bot
        success = await self.bot.plugin_manager.unload_plugin(plugin_id)
        if success:
            # Sync commands to this guild immediately
            await self.bot.plugin_manager.sync_commands(guild_id=interaction.guild_id)
            await interaction.followup.send(f"✅ Plugin `{plugin_id}` disabled and commands synced.")
        else:
            await interaction.followup.send(f"❌ Plugin `{plugin_id}` disabled in settings but was not active.")

    @plugin_group.command(name="reload", description="Reload a plugin's code")
    @app_commands.describe(plugin_id="The folder name of the plugin")
    async def plugin_reload(self, interaction: discord.Interaction, plugin_id: str):
        await interaction.response.defer()
        success = await self.bot.plugin_manager.reload_plugin(plugin_id)
        if success:
            await self.bot.plugin_manager.sync_commands(guild_id=interaction.guild_id)
            await interaction.followup.send(f"✅ Plugin `{plugin_id}` reloaded successfully.")
        else:
            await interaction.followup.send(f"❌ Failed to reload plugin `{plugin_id}`. Check console for traceback.")

    @plugin_group.command(name="sync", description="Force-sync all slash commands to this server")
    async def plugin_sync(self, interaction: discord.Interaction):
        await interaction.response.defer()
        try:
            await self.bot.plugin_manager.sync_commands(guild_id=interaction.guild_id)
            await interaction.followup.send("✅ Commands synced to this server.")
        except Exception as e:
            await interaction.followup.send(f"❌ Sync failed: {e}")

async def setup(bot: SparkSageBot):
    await bot.add_cog(PluginCog(bot))
