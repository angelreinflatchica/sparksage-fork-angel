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

        # Use the most recent 10 messages for the summary context to avoid
        # extremely long inputs which may cause some providers to return
        # empty responses.
        context_history = history[-10:]

        summary_prompt = (
            "- Summarize the conversation in 3 concise bullet points.\n"
            "- Each bullet: 1–2 short sentences.\n"
            "- Include key topics, decisions, action items, and open questions.\n"
            "- Use plain, neutral language."
        )
        
        try:
            # providers.chat is synchronous, so we run it in a thread to avoid blocking
            response, provider_name, input_tokens, output_tokens, estimated_cost, latency = await asyncio.to_thread(
                providers.chat, context_history, summary_prompt
            )

            # Debug prints to help diagnose empty responses
            print("DEBUG: summarize -> provider:", provider_name)
            try:
                print("DEBUG: summarize -> raw response repr:", repr(response))
            except Exception:
                print("DEBUG: summarize -> raw response (unprintable)")
            print(f"DEBUG: tokens in={input_tokens} out={output_tokens} est_cost={estimated_cost} latency_ms={latency}")

            # If provider returned a non-string (edge case), coerce to string
            if not isinstance(response, str):
                response = str(response)

            # If the provider returned an empty response, retry with a
            # compact single-message transcript (some providers handle
            # single user-message prompts more reliably).
            response_text = response.strip() if isinstance(response, str) and response else ""
            if not response_text:
                print("DEBUG: summarize -> initial response empty, retrying with single-user transcript...")
                transcript = "\n".join([f"{m['role']}: {m['content']}" for m in context_history])
                user_msg = summary_prompt + "\n\nTranscript:\n" + transcript
                # Retry using system default and a single user message
                try:
                    response2, provider_name2, input_tokens2, output_tokens2, estimated_cost2, latency2 = await asyncio.to_thread(
                        providers.chat, [{"role": "user", "content": user_msg}], config.SYSTEM_PROMPT
                    )
                    print("DEBUG: summarize -> retry provider:", provider_name2)
                    print("DEBUG: summarize -> retry raw response repr:", repr(response2))
                    # Use retry response if non-empty
                    if isinstance(response2, str) and response2.strip():
                        response = response2
                        provider_name = provider_name2
                        input_tokens = input_tokens2
                        output_tokens = output_tokens2
                        estimated_cost = estimated_cost2
                        latency = latency2
                        response_text = response.strip()
                except Exception as e:
                    print(f"DEBUG: summarize retry failed: {e}")
            
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
            # Handle empty or whitespace-only responses from providers
            response_text = response.strip() if isinstance(response, str) and response else ""
            if not response_text:
                response_text = "No summary content was generated. The provider returned an empty response."

            full_response = header + response_text

            for i in range(0, len(full_response), 2000):
                await interaction.followup.send(full_response[i : i + 2000])
                
        except RuntimeError as e:
            await interaction.followup.send(f"Summary failed: {e}")

async def setup(bot):
    await bot.add_cog(Summarize(bot))
