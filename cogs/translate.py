from __future__ import annotations

import logging
from typing import TYPE_CHECKING

import discord
from discord import app_commands
from discord.ext import commands

import db as database
import config
import providers
from utils.checks import has_command_permission

if TYPE_CHECKING:
    from bot import bot

logger = logging.getLogger("sparksage.translate")

class Translate(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @app_commands.command(name="translate", description="Translate text into a target language")
    @app_commands.describe(
        text="The text to translate",
        target_language="The language to translate into (e.g., Spanish, Japanese, English)"
    )
    @app_commands.check(has_command_permission)
    async def translate(self, interaction: discord.Interaction, text: str, target_language: str):
        await interaction.response.defer()
        
        prompt = (
            f"Translate the following text into {target_language}. "
            "Only respond with the translated text, no extra explanation or conversational filler.\n\n"
            f"Text: {text}"
        )
        
        try:
            import asyncio
            response, provider_name, input_tokens, output_tokens, estimated_cost, latency = await asyncio.to_thread(
                providers.chat, [{"role": "user", "content": prompt}], "You are a professional translator."
            )
            
            # Record analytics
            ch_obj = self.bot.get_channel(interaction.channel_id)
            ch_name = ch_obj.name if ch_obj else None
            await database.record_event(
                event_type="command",
                guild_id=str(interaction.guild_id),
                channel_id=str(interaction.channel_id),
                channel_name=ch_name,
                user_id=str(interaction.user.id),
                provider=provider_name,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                estimated_cost=estimated_cost,
                latency_ms=latency
            )

            provider_label = config.PROVIDERS.get(provider_name, {}).get("name", provider_name)
            
            embed = discord.Embed(
                title=f"🌐 Translated to {target_language.capitalize()}",
                description=response,
                color=discord.Color.blue()
            )
            embed.set_footer(text=f"Powered by {provider_label}")
            
            await interaction.followup.send(embed=embed)
            
        except Exception as e:
            logger.error(f"Translation failed: {e}")
            await interaction.followup.send(f"Translation failed: {e}")

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if message.author.bot or not message.guild:
            return

        guild_id = str(message.guild.id)
        enabled = await database.get_effective_config("TRANSLATE_AUTO_ENABLED", guild_id=guild_id, default="0")
        if enabled != "1":
            return

        auto_channel_id = await database.get_effective_config("TRANSLATE_AUTO_CHANNEL_ID", guild_id=guild_id)
        if not auto_channel_id or str(message.channel.id) != auto_channel_id:
            return

        target_lang = await database.get_effective_config("TRANSLATE_AUTO_TARGET", guild_id=guild_id, default="English")

        # Use AI to detect if translation is needed and translate if so
        # Prompt logic: Detect language, if not target_lang, translate. 
        # If it is already target_lang, respond with "ALREADY_TARGET".
        prompt = (
            f"Detect the language of the message below. If it is NOT {target_lang}, "
            f"translate it to {target_lang}. If it is ALREADY {target_lang}, "
            "respond exactly with 'SKIP'. "
            "Only provide the translation or the word 'SKIP', no other text.\n\n"
            f"Message: {message.content}"
        )

        try:
            import asyncio
            response, provider_name, input_tokens, output_tokens, estimated_cost, latency = await asyncio.to_thread(
                providers.chat, [{"role": "user", "content": prompt}], "You are a multilingual auto-translator."
            )
            
            if response.strip().upper() == "SKIP":
                return

            # Record analytics
            ch_obj = self.bot.get_channel(message.channel.id)
            ch_name = ch_obj.name if ch_obj else None
            await database.record_event(
                event_type="translate_auto",
                guild_id=str(message.guild.id),
                channel_id=str(message.channel.id),
                channel_name=ch_name,
                user_id=str(message.author.id),
                provider=provider_name,
                input_tokens=input_tokens,
                output_tokens=output_tokens,
                estimated_cost=estimated_cost,
                latency_ms=latency
            )

            embed = discord.Embed(
                description=response,
                color=discord.Color.blue(),
            )
            embed.set_author(name=f"Translation for {message.author.display_name}", icon_url=message.author.display_avatar.url)
            embed.set_footer(text=f"Target: {target_lang}")
            
            await message.channel.send(embed=embed, reference=message)
            
        except Exception as e:
            logger.error(f"Auto-translation failed: {e}")

async def setup(bot: commands.Bot):
    await bot.add_cog(Translate(bot))
