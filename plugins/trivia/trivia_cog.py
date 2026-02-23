import discord
from discord.ext import commands
from discord import app_commands
import random

class TriviaCog(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self._quiz_questions = [
            {"question": "What is the capital of France?", "answer": "Paris"},
            {"question": "What is 2 + 2?", "answer": "4"},
            {"question": "Which planet is known as the Red Planet?", "answer": "Mars"},
            {"question": "What is the largest ocean on Earth?", "answer": "Pacific Ocean"},
            {"question": "Who painted the Mona Lisa?", "answer": "Leonardo da Vinci"},
        ]
        self._current_game = {} # Stores game state per channel: {channel_id: {"question_index": int, "score": int, "started_by": int}}

    trivia_group = app_commands.Group(name="trivia", description="Play a game of trivia!")

    @trivia_group.command(name="start", description="Start a new trivia game")
    async def start_trivia(self, interaction: discord.Interaction):
        if interaction.channel_id in self._current_game:
            await interaction.response.send_message("A trivia game is already in progress in this channel!", ephemeral=True)
            return

        self._current_game[interaction.channel_id] = {
            "question_index": -1, # -1 indicates game started but no question asked yet
            "score": 0,
            "started_by": interaction.user.id
        }
        await interaction.response.send_message("Trivia game started! Get ready for your first question...")
        await self._ask_next_question(interaction.channel)

    async def _ask_next_question(self, channel: discord.TextChannel):
        game_state = self._current_game.get(channel.id)
        if not game_state:
            return

        game_state["question_index"] += 1
        if game_state["question_index"] >= len(self._quiz_questions):
            await channel.send(f"End of trivia! Your final score is {game_state['score']} points.")
            del self._current_game[channel.id]
            return

        question = self._quiz_questions[game_state["question_index"]]["question"]
        await channel.send(f"**Question {game_state['question_index'] + 1}:** {question}")

    @trivia_group.command(name="answer", description="Submit your answer to the current trivia question")
    @app_commands.describe(answer="Your answer")
    async def answer_trivia(self, interaction: discord.Interaction, answer: str):
        game_state = self._current_game.get(interaction.channel_id)
        if not game_state or game_state["question_index"] == -1:
            await interaction.response.send_message("No trivia game is currently active or a question hasn't been asked yet. Use `/trivia start` to begin!", ephemeral=True)
            return
        
        current_question = self._quiz_questions[game_state["question_index"]]
        correct_answer = current_question["answer"]

        if answer.lower() == correct_answer.lower():
            game_state["score"] += 1
            await interaction.response.send_message(f"✅ Correct! Your score: {game_state['score']}")
            await self._ask_next_question(interaction.channel)
        else:
            await interaction.response.send_message(f"❌ Incorrect. The answer was **{correct_answer}**. Your score: {game_state['score']}")
            await self._ask_next_question(interaction.channel)

    @trivia_group.command(name="stop", description="Stop the current trivia game")
    async def stop_trivia(self, interaction: discord.Interaction):
        game_state = self._current_game.get(interaction.channel_id)
        if not game_state:
            await interaction.response.send_message("No trivia game is active in this channel.", ephemeral=True)
            return
        
        if interaction.user.id != game_state["started_by"]:
            await interaction.response.send_message("Only the person who started the game can stop it!", ephemeral=True)
            return

        del self._current_game[interaction.channel_id]
        await interaction.response.send_message("Trivia game stopped. Thanks for playing!")

async def setup(bot):
    await bot.add_cog(TriviaCog(bot))
