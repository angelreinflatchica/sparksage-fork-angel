from discord.ext import commands
from discord import app_commands
import discord
import db as database
import providers
import config
from utils.checks import has_command_permission

class FAQ(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    faq_group = app_commands.Group(
        name="faq", 
        description="Manage FAQ entries",
        default_permissions=discord.Permissions(manage_messages=True)
    )

    @faq_group.command(name="add", description="Add a new FAQ entry")
    @app_commands.describe(
        question="The question users ask",
        answer="The answer to provide",
        keywords="Comma-separated keywords to trigger auto-detection"
    )
    @app_commands.check(has_command_permission)
    async def faq_add(self, interaction: discord.Interaction, question: str, answer: str, keywords: str):
        db = await database.get_db()
        await db.execute(
            "INSERT INTO faqs (guild_id, question, answer, match_keywords, created_by) VALUES (?, ?, ?, ?, ?)",
            (str(interaction.guild_id), question, answer, keywords, str(interaction.user))
        )
        await db.commit()
        await interaction.response.send_message(f"FAQ added: **{question}**")

    @faq_group.command(name="list", description="List all FAQs for this server")
    @app_commands.check(has_command_permission)
    async def faq_list(self, interaction: discord.Interaction):
        db = await database.get_db()
        cursor = await db.execute("SELECT id, question FROM faqs WHERE guild_id = ?", (str(interaction.guild_id),))
        rows = await cursor.fetchall()
        
        if not rows:
            await interaction.response.send_message("No FAQs configured for this server.")
            return
            
        msg = "**Server FAQs:**\n" + "\n".join([f"{row['id']}. {row['question']}" for row in rows])
        await interaction.response.send_message(msg)

    @faq_group.command(name="remove", description="Remove a FAQ entry")
    @app_commands.describe(faq_id="The ID of the FAQ to remove")
    @app_commands.check(has_command_permission)
    async def faq_remove(self, interaction: discord.Interaction, faq_id: int):
        db = await database.get_db()
        await db.execute("DELETE FROM faqs WHERE id = ? AND guild_id = ?", (faq_id, str(interaction.guild_id)))
        await db.commit()
        await interaction.response.send_message(f"FAQ #{faq_id} removed.")

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if message.author.bot or not message.guild:
            return
            
        # Check if message matches any FAQ keywords
        db = await database.get_db()
        cursor = await db.execute("SELECT id, question, answer, match_keywords FROM faqs WHERE guild_id = ?", (str(message.guild.id),))
        faqs = await cursor.fetchall()
        
        content_lower = message.content.lower()
        for faq in faqs:
            keywords = [k.strip().lower() for k in faq['match_keywords'].split(',')]
            if any(k in content_lower for k in keywords if k):
                # Match found!
                await message.reply(f"**FAQ: {faq['question']}**\n{faq['answer']}")
                # Increment usage
                await db.execute("UPDATE faqs SET times_used = times_used + 1 WHERE id = ?", (faq['id'],))
                await db.commit()
                break

async def setup(bot):
    await bot.add_cog(FAQ(bot))
