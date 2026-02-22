from discord.ext import commands
from discord import app_commands
import discord
import db as database

class ChannelPrompts(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    prompt_group = app_commands.Group(
        name="prompt", 
        description="Manage custom system prompts per channel",
        default_permissions=discord.Permissions(administrator=True)
    )

    @prompt_group.command(name="set", description="Set a custom system prompt for this channel")
    @app_commands.describe(text="The system prompt for this channel")
    async def prompt_set(self, interaction: discord.Interaction, text: str):
        db = await database.get_db()
        await db.execute(
            "INSERT INTO channel_prompts (channel_id, guild_id, system_prompt) VALUES (?, ?, ?) "
            "ON CONFLICT(channel_id) DO UPDATE SET system_prompt = excluded.system_prompt",
            (str(interaction.channel_id), str(interaction.guild_id), text)
        )
        await db.commit()
        await interaction.response.send_message(f"Custom prompt set for this channel.")

    @prompt_group.command(name="reset", description="Reset to the global system prompt")
    async def prompt_reset(self, interaction: discord.Interaction):
        db = await database.get_db()
        await db.execute("DELETE FROM channel_prompts WHERE channel_id = ?", (str(interaction.channel_id),))
        await db.commit()
        await interaction.response.send_message("Channel prompt reset to global default.")

async def get_channel_prompt(channel_id: str) -> str | None:
    """Helper to get a channel-specific prompt."""
    db = await database.get_db()
    cursor = await db.execute("SELECT system_prompt FROM channel_prompts WHERE channel_id = ?", (channel_id,))
    row = await cursor.fetchone()
    return row['system_prompt'] if row else None

async def setup(bot):
    await bot.add_cog(ChannelPrompts(bot))
