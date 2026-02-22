import asyncio
from discord.ext import commands
from discord import app_commands
import discord
import db as database
import config
import providers
from utils.checks import has_command_permission

class Summarize(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    async def get_history(self, channel_id: int) -> list[dict]:
        """Get conversation history for a channel from the database."""
        messages = await database.get_messages(str(channel_id), limit=20)
        return [{"role": m["role"], "content": m["content"]} for m in messages]

    @app_commands.command(name="summarize", description="Summarize the recent conversation in this channel")
    @app_commands.check(has_command_permission)
    async def summarize(self, interaction: discord.Interaction):
        await interaction.response.defer()
        
        history = []
        try:
            # Fetch the last 50 messages from the actual Discord channel history.
            # This ensures we summarize real conversation, not just bot interactions.
            async for msg in interaction.channel.history(limit=50, oldest_first=False):
                if msg.id == interaction.id:
                    continue
                    
                role = "assistant" if msg.author.bot else "user"
                content = msg.content
                if not content and msg.embeds:
                    content = "[Embed Content]"
                
                if content:
                    # Insert at the beginning to maintain chronological order
                    history.insert(0, {"role": role, "content": f"{msg.author.display_name}: {content}"})
        except Exception as e:
            # Fallback to DB history if channel history fetch fails
            db_history = await self.get_history(interaction.channel_id)
            if db_history:
                history = db_history
            else:
                await interaction.followup.send(f"Could not fetch channel history: {e}")
                return

        if not history:
            await interaction.followup.send("No conversation history found to summarize.")
            return

        # Use the most recent 30 messages for the summary context
        context_history = history[-30:]

        summary_prompt = (
            "You are a helpful assistant. Below is a transcript of a recent conversation in a Discord channel. "
            "Please provide a concise summary of the main topics discussed, key decisions made, and any pending questions. "
            "Use bullet points and be clear about who said what if it is important."
        )
        
        try:
            # providers.chat is synchronous, so we run it in a thread to avoid blocking
            response, provider_name, tokens, latency = await asyncio.to_thread(
                providers.chat, context_history, summary_prompt
            )
            
            # Record analytics
            await database.record_event(
                event_type="command",
                guild_id=str(interaction.guild_id),
                channel_id=str(interaction.channel_id),
                user_id=str(interaction.user.id),
                provider=provider_name,
                tokens_used=tokens,
                latency_ms=latency
            )

            # Split long responses (Discord 2000 char limit)
            header = "**Conversation Summary:**\n"
            full_response = header + response
            
            for i in range(0, len(full_response), 2000):
                await interaction.followup.send(full_response[i : i + 2000])
                
        except RuntimeError as e:
            await interaction.followup.send(f"Summary failed: {e}")

async def setup(bot):
    await bot.add_cog(Summarize(bot))
