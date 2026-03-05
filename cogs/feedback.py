from __future__ import annotations

import discord
from discord.ext import commands
from discord import app_commands
import db


class Feedback(commands.Cog):
    """Handle AI response feedback via reactions."""

    def __init__(self, bot):
        self.bot = bot
        self.helpful_emoji = "👍"
        self.not_helpful_emoji = "👎"

    @commands.Cog.listener()
    async def on_raw_reaction_add(self, payload: discord.RawReactionActionEvent):
        """Handle reaction adds for feedback."""
        if payload.user_id == self.bot.user.id:
            return  # Ignore bot's own reactions

        # Only process helpful/not helpful reactions
        if payload.emoji.name not in [self.helpful_emoji, "👍", "👎"]:
            return

        try:
            channel = await self.bot.fetch_channel(payload.channel_id)
            message = await channel.fetch_message(payload.message_id)

            # Only process if the message is from the bot
            if message.author.id != self.bot.user.id:
                return

            # Check if message has embeds or content from an AI response (simple heuristic)
            if not (message.embeds or message.content.strip()):
                return

            # Determine if helpful or not
            helpful = 1 if payload.emoji.name == "👍" else 0

            # Record feedback
            await db.record_feedback(
                message_id=str(payload.message_id),
                channel_id=str(payload.channel_id),
                guild_id=str(payload.guild_id) if payload.guild_id else None,
                helpful=helpful,
                user_id=str(payload.user_id),
            )

        except Exception as e:
            print(f"Error processing feedback reaction: {e}")


async def setup(bot):
    await bot.add_cog(Feedback(bot))
