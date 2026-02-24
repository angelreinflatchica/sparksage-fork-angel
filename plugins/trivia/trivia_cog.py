import discord
from discord.ext import commands
from discord import app_commands

class Trivia(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(name="trivia", description="Start a quick trivia question")
    async def trivia(self, interaction: discord.Interaction):
        # Simple placeholder trivia question; replace with richer game logic as needed
        question = "What is the capital of France?"
        options = ["Paris", "Berlin", "Rome", "Madrid"]
        correct = "Paris"

        # Build a simple response
        content = f"**Trivia:** {question}\n"
        for i, opt in enumerate(options, start=1):
            content += f"{i}. {opt}\n"
        content += "\nReply with the number of your answer."

        await interaction.response.send_message(content)

async def setup(bot: commands.Bot):
    await bot.add_cog(Trivia(bot))
