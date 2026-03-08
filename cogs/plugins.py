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

    async def _safe_defer(self, interaction: discord.Interaction, ephemeral: bool = False):
        """Defer only when the interaction has not been acknowledged yet."""
        if not interaction.response.is_done():
            await interaction.response.defer(ephemeral=ephemeral)

    async def _safe_send(
        self,
        interaction: discord.Interaction,
        content: str | None = None,
        *,
        embed: discord.Embed | None = None,
        ephemeral: bool = False,
    ):
        """Send via initial response or followup depending on interaction state."""
        if interaction.response.is_done():
            await interaction.followup.send(content=content, embed=embed, ephemeral=ephemeral)
        else:
            await interaction.response.send_message(content=content, embed=embed, ephemeral=ephemeral)

    plugin_group = app_commands.Group(
        name="plugin",
        description="Manage community plugins"
    )

    @plugin_group.command(name="list", description="List all installed plugins")
    async def plugin_list(self, interaction: discord.Interaction):
        plugins = await db.get_plugins()
        if not plugins:
            await self._safe_send(interaction, "No plugins installed in `plugins/` directory.")
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
        await self._safe_send(interaction, embed=embed)

    @plugin_group.command(name="enable", description="Enable a plugin")
    @app_commands.describe(plugin_id="The folder name of the plugin")
    async def plugin_enable(self, interaction: discord.Interaction, plugin_id: str):
        await self._safe_defer(interaction)
        success, message = await self.bot.plugin_manager.load_plugin(plugin_id)
        if success:
            # Sync commands to this guild immediately
            sync_success, sync_message = await self.bot.plugin_manager.sync_commands(guild_id=interaction.guild_id)
            if sync_success:
                await self._safe_send(interaction, f"✅ Plugin `{plugin_id}` enabled and commands synced.")
            else:
                await self._safe_send(
                    interaction,
                    f"⚠️ Plugin `{plugin_id}` enabled, but command sync failed: {sync_message}",
                )
        else:
            await self._safe_send(interaction, f"❌ Failed to enable plugin `{plugin_id}`: {message}")

    @plugin_group.command(name="disable", description="Disable a plugin")
    @app_commands.describe(plugin_id="The folder name of the plugin")
    async def plugin_disable(self, interaction: discord.Interaction, plugin_id: str):
        await self._safe_defer(interaction)
        success, message = await self.bot.plugin_manager.unload_plugin(plugin_id)
        if success:
            # Sync commands to this guild immediately
            sync_success, sync_message = await self.bot.plugin_manager.sync_commands(guild_id=interaction.guild_id)
            if sync_success:
                await self._safe_send(interaction, f"✅ Plugin `{plugin_id}` disabled and commands synced.")
            else:
                await self._safe_send(
                    interaction,
                    f"⚠️ Plugin `{plugin_id}` disabled, but command sync failed: {sync_message}",
                )
        else:
            await self._safe_send(interaction, f"❌ Failed to disable plugin `{plugin_id}`: {message}")

    @plugin_group.command(name="reload", description="Reload a plugin's code")
    @app_commands.describe(plugin_id="The folder name of the plugin")
    async def plugin_reload(self, interaction: discord.Interaction, plugin_id: str):
        await self._safe_defer(interaction)
        success, message = await self.bot.plugin_manager.reload_plugin(plugin_id)
        if success:
            sync_success, sync_message = await self.bot.plugin_manager.sync_commands(guild_id=interaction.guild_id)
            if sync_success:
                await self._safe_send(interaction, f"✅ Plugin `{plugin_id}` reloaded successfully.")
            else:
                await self._safe_send(
                    interaction,
                    f"⚠️ Plugin `{plugin_id}` reloaded, but command sync failed: {sync_message}",
                )
        else:
            await self._safe_send(interaction, f"❌ Failed to reload plugin `{plugin_id}`: {message}")

    @plugin_group.command(name="sync", description="Force-sync all slash commands to this server")
    async def plugin_sync(self, interaction: discord.Interaction):
        await self._safe_defer(interaction)
        try:
            success, message = await self.bot.plugin_manager.sync_commands(guild_id=interaction.guild_id)
            if success:
                await self._safe_send(interaction, "✅ Commands synced to this server.")
            else:
                await self._safe_send(interaction, f"❌ Sync failed: {message}")
        except Exception as e:
            await self._safe_send(interaction, f"❌ Sync failed: {e}")

async def setup(bot: SparkSageBot):
    await bot.add_cog(PluginCog(bot))
