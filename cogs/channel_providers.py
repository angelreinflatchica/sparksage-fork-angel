from discord.ext import commands
from discord import app_commands
import discord
import db as database
import config

class ChannelProviders(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    channel_provider_group = app_commands.Group(
        name="channel-provider", 
        description="Manage custom AI providers per channel",
        default_permissions=discord.Permissions(administrator=True)
    )

    @channel_provider_group.command(name="set", description="Set a custom AI provider for this channel")
    @app_commands.describe(provider="The AI provider to use (e.g., gemini, groq, openai)")
    async def channel_provider_set(self, interaction: discord.Interaction, provider: str):
        provider = provider.lower()
        if provider not in config.PROVIDERS:
            await interaction.response.send_message(f"Unknown provider: {provider}. Available: {', '.join(config.PROVIDERS.keys())}", ephemeral=True)
            return

        db = await database.get_db()
        await db.execute(
            "INSERT INTO channel_providers (channel_id, guild_id, provider) VALUES (?, ?, ?) "
            "ON CONFLICT(channel_id) DO UPDATE SET provider = excluded.provider",
            (str(interaction.channel_id), str(interaction.guild_id), provider)
        )
        await db.commit()
        await interaction.response.send_message(f"AI provider for this channel set to **{provider}**.")

    @channel_provider_group.command(name="reset", description="Reset to the global primary provider")
    async def channel_provider_reset(self, interaction: discord.Interaction):
        db = await database.get_db()
        await db.execute("DELETE FROM channel_providers WHERE channel_id = ?", (str(interaction.channel_id),))
        await db.commit()
        await interaction.response.send_message("Channel provider reset to global default.")

async def get_channel_provider(channel_id: str) -> str | None:
    """Helper to get a channel-specific provider."""
    db = await database.get_db()
    cursor = await db.execute("SELECT provider FROM channel_providers WHERE channel_id = ?", (channel_id,))
    row = await cursor.fetchone()
    return row['provider'] if row else None

async def setup(bot):
    await bot.add_cog(ChannelProviders(bot))
