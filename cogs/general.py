from discord.ext import commands
from discord import app_commands
import discord
import config
import providers
import db as database
from utils.checks import has_command_permission
from cogs.prompts import get_channel_prompt
from cogs.channel_providers import get_channel_provider

class General(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    async def get_history(self, channel_id: int) -> list[dict]:
        """Get conversation history for a channel from the database."""
        messages = await database.get_messages(str(channel_id), limit=20)
        return [{"role": m["role"], "content": m["content"]} for m in messages]

    async def ask_ai(self, guild_id: int | None, channel_id: int, user_id: int, user_name: str, message: str) -> tuple[str, str]:
        """Send a message to AI and return (response, provider_name)."""
        # Store user message in DB
        await database.add_message(str(channel_id), "user", f"{user_name}: {message}")

        history = await self.get_history(channel_id)

        # Check for channel-specific prompt override
        channel_prompt = await get_channel_prompt(str(channel_id))
        active_prompt = channel_prompt if channel_prompt else config.SYSTEM_PROMPT

        # Check for channel-specific provider override
        channel_provider = await get_channel_provider(str(channel_id))

        try:
            # providers.chat is synchronous, so we run it in a thread to avoid blocking
            import asyncio
            response, provider_name, tokens, latency = await asyncio.to_thread(
                providers.chat, history, active_prompt, override_primary=channel_provider
            )
            await database.record_event(
                "command",
                guild_id=str(guild_id) if guild_id else None,
                channel_id=str(channel_id),
                user_id=str(user_id),
                provider=provider_name,
                tokens_used=tokens,
                latency_ms=latency
            )
            # Store assistant response in DB
            await database.add_message(str(channel_id), "assistant", response, provider=provider_name)
            return response, provider_name
        except RuntimeError as e:
            return f"Sorry, all AI providers failed:\n{e}", "none"

    @app_commands.command(name="ask", description="Ask SparkSage a question")
    @app_commands.describe(question="Your question for SparkSage")
    @app_commands.check(has_command_permission)
    async def ask(self, interaction: discord.Interaction, question: str):
        await interaction.response.defer()
        response, provider_name = await self.ask_ai(
            interaction.guild_id, interaction.channel_id, interaction.user.id, interaction.user.display_name, question
        )
        provider_label = config.PROVIDERS.get(provider_name, {}).get("name", provider_name)
        footer = f"\n-# Powered by {provider_label}"

        for i in range(0, len(response), 1900):
            chunk = response[i : i + 1900]
            if i + 1900 >= len(response):
                chunk += footer
            await interaction.followup.send(chunk)

    @app_commands.command(name="clear", description="Clear SparkSage's conversation memory for this channel")
    @app_commands.check(has_command_permission)
    async def clear(self, interaction: discord.Interaction):
        await database.clear_messages(str(interaction.channel_id))
        await interaction.response.send_message("Conversation history cleared!")

    @app_commands.command(name="provider", description="Show which AI provider SparkSage is currently using")
    @app_commands.check(has_command_permission)
    async def provider(self, interaction: discord.Interaction):
        primary = config.AI_PROVIDER
        provider_info = config.PROVIDERS.get(primary, {})
        available = providers.get_available_providers()

        msg = f"**Current Provider:** {provider_info.get('name', primary)}\n"
        msg += f"**Model:** `{provider_info.get('model', '?')}`\n"
        msg += f"**Free:** {'Yes' if provider_info.get('free') else 'No (paid)'}\n"
        msg += f"**Fallback Chain:** {' -> '.join(available)}"
        await interaction.response.send_message(msg)

async def setup(bot):
    await bot.add_cog(General(bot))
