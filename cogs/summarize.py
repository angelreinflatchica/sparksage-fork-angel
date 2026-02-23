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
        
        history = await self.get_history(interaction.channel_id)

        if not history:
            await interaction.followup.send("No bot conversation history found to summarize.")
            return

        # Use the most recent 30 messages for the summary context
        context_history = history[-30:]

        summary_prompt = (
            "You are an expert summarizer and storyteller, tasked with transforming a Discord conversation into a coherent narrative. "
            "Analyze the transcript below and craft a concise, well-structured summary that flows like a story. "
            "Connect ideas logically, using transition words and phrases to highlight the progression of topics, decisions, and discussions. "
            "Organize your summary into distinct paragraphs, each focusing on a main theme or phase of the conversation. "
            "Ensure clarity and avoid merely listing points. Focus on key topics, significant decisions, and any unresolved questions."
        )
        
        try:
            # providers.chat is synchronous, so we run it in a thread to avoid blocking
            response, provider_name, input_tokens, output_tokens, estimated_cost, latency = await asyncio.to_thread(
                providers.chat, context_history, summary_prompt
            )
            
            estimated_cost = providers.calculate_cost(provider_name, input_tokens, output_tokens)
            
            # Record analytics
            await database.record_event(
                event_type="command",
                guild_id=str(interaction.guild_id),
                channel_id=str(interaction.channel_id),
                user_id=str(interaction.user.id),
                provider=provider_name,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                estimated_cost=estimated_cost,
                latency_ms=latency
            )

            # Split long responses (Discord 2000 char limit)
            header = "Here’s the conversation summary: \n"
            full_response = header + (response if response is not None else "No summary content was generated.")
            
            for i in range(0, len(full_response), 2000):
                await interaction.followup.send(full_response[i : i + 2000])
                
        except RuntimeError as e:
            await interaction.followup.send(f"Summary failed: {e}")

async def setup(bot):
    await bot.add_cog(Summarize(bot))
