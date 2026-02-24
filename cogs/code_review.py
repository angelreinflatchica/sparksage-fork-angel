import discord
from discord import app_commands
from discord.ext import commands
import config
import providers
import db as database
from utils.checks import has_command_permission

class CodeReview(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(
        name="review",
        description="Analyze code for bugs, style, performance, and security"
    )
    @app_commands.describe(
        code="Paste your code snippet here",
        language="Optional: programming language (e.g., python, javascript)"
    )
    @app_commands.check(has_command_permission)
    async def review(self, interaction: discord.Interaction, code: str, language: str = None):
        await interaction.response.defer()

        # Specialized system prompt
        prompt = f"""
You are a senior code reviewer. Analyze the following code for:
1. Bugs and potential errors
2. Style and best practices
3. Performance improvements
4. Security concerns

Respond with markdown formatting using code blocks.
Language hint: {language if language else "auto-detect"}
Code:
{code}
        """

        # Call AI provider
        import asyncio
        response, provider_name, input_tokens, output_tokens, estimated_cost, latency = await asyncio.to_thread(
            providers.chat,
            [{"role": "user", "content": prompt}],
            config.SYSTEM_PROMPT
        )
        await database.record_event(
            "command",
            guild_id=str(interaction.guild_id) if interaction.guild_id else None,
            channel_id=str(interaction.channel_id),
            user_id=str(interaction.user.id),
            provider=provider_name,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost=estimated_cost,
            latency_ms=latency
        )

        # Save response to DB with a marker for the new dashboard
        db_content = f"[Code Review]\n{response}"
        await database.add_message(str(interaction.channel_id), "assistant", db_content, provider=provider_name)

        # Split long responses (Discord 2000 char limit)
        for i in range(0, len(response), 2000):
            await interaction.followup.send(response[i : i + 2000])

async def setup(bot: commands.Bot):
    await bot.add_cog(CodeReview(bot))
