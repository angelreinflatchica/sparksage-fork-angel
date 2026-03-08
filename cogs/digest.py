from __future__ import annotations

import datetime
import logging
from typing import TYPE_CHECKING

import discord
from discord import app_commands
from discord.ext import commands, tasks

import db as database
import config
import providers
from utils.checks import has_command_permission

if TYPE_CHECKING:
    from bot import bot

logger = logging.getLogger("sparksage.digest")
PH_TZ = datetime.timezone(datetime.timedelta(hours=8), name="UTC+08:00")

class Digest(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.daily_digest.start()
        self.last_run_date_by_guild: dict[int, datetime.date] = {}

    async def _safe_defer(self, interaction: discord.Interaction, ephemeral: bool = False):
        if not interaction.response.is_done():
            await interaction.response.defer(ephemeral=ephemeral)

    async def _safe_send(
        self,
        interaction: discord.Interaction,
        content: str,
        *,
        ephemeral: bool = False,
    ):
        if interaction.response.is_done():
            await interaction.followup.send(content, ephemeral=ephemeral)
        else:
            await interaction.response.send_message(content, ephemeral=ephemeral)

    def cog_unload(self):
        self.daily_digest.cancel()

    @tasks.loop(minutes=1)
    async def daily_digest(self):
        """Check every minute if it is digest time per guild."""
        now_dt = datetime.datetime.now(PH_TZ)
        now_str = now_dt.strftime("%H:%M")
        today_date = now_dt.date()

        for guild in self.bot.guilds:
            guild_id = str(guild.id)
            enabled = await database.get_effective_config("DIGEST_ENABLED", guild_id=guild_id, default="0")
            if enabled != "1":
                continue

            target_time = await database.get_effective_config("DIGEST_TIME", guild_id=guild_id, default="09:00")
            try:
                datetime.time.fromisoformat(target_time)
            except ValueError:
                logger.warning(
                    "Daily digest skipped for guild %s: invalid DIGEST_TIME value '%s' (expected HH:MM).",
                    guild.id,
                    target_time,
                )
                continue

            if now_str != target_time:
                continue

            if self.last_run_date_by_guild.get(guild.id) == today_date:
                continue

            logger.info("Running scheduled daily digest for guild %s at %s PHT (UTC+8)", guild.id, now_str)
            await self.run_digest(guild_override=guild)
            self.last_run_date_by_guild[guild.id] = today_date

    async def run_digest(
        self,
        channel_override: discord.TextChannel | None = None,
        guild_override: discord.Guild | None = None,
    ):
        """Core logic to collect messages, summarize, and post the digest."""
        target_guild = guild_override

        # Get target channel
        if channel_override:
            target_channel = channel_override
            if target_guild is None:
                target_guild = channel_override.guild
        else:
            if target_guild is None:
                logger.warning("Daily digest skipped: no guild context available.")
                return

            guild_id = str(target_guild.id)
            channel_id_str = await database.get_effective_config("DIGEST_CHANNEL_ID", guild_id=guild_id)
            if not channel_id_str:
                logger.warning("Daily digest skipped for guild %s: DIGEST_CHANNEL_ID not set.", target_guild.id)
                return
            
            try:
                channel_id = int(channel_id_str)
                target_channel = self.bot.get_channel(channel_id)
            except (ValueError, TypeError):
                logger.error(f"Daily digest error: Invalid channel ID '{channel_id_str}'")
                return

        if not target_channel:
            logger.error("Daily digest error: Could not find target channel.")
            return

        # Collect activity from the last 24 hours
        yesterday = datetime.datetime.utcnow() - datetime.timedelta(days=1)
        if target_guild is None:
            logger.warning("Daily digest skipped: target guild not found.")
            return

        channel_activity: list[tuple[discord.TextChannel, list[dict]]] = []
        for channel in target_guild.text_channels:
            messages = await database.get_messages(str(channel.id), limit=100)

            recent_messages = []
            for m in messages:
                try:
                    created_at = datetime.datetime.strptime(m["created_at"], "%Y-%m-%d %H:%M:%S")
                    if created_at > yesterday:
                        recent_messages.append({"role": m["role"], "content": m["content"]})
                except (ValueError, KeyError):
                    continue

            if recent_messages:
                channel_activity.append((channel, recent_messages))

        channel_activity.sort(key=lambda item: len(item[1]), reverse=True)
        
        # We'll filter and summarize the top 5 most active channels
        summary_sections = []
        
        for channel, recent_messages in channel_activity[:5]:
            ch_id = str(channel.id)
            ch_name = channel.name
            
            prompt = f"Summarize the recent activity in the Discord channel '{ch_name}' from the last 24 hours. Provide 2-3 concise bullet points highlighting key topics or decisions. Be friendly and engaging."
            
            try:
                # Use providers.chat with history as context
                import asyncio
                response, provider_name, input_tokens, output_tokens, estimated_cost, latency = await asyncio.to_thread(
                    providers.chat, recent_messages, prompt
                )
                if response is None:
                    logger.warning("Digest summary empty for channel %s (provider=%s): response=None", ch_id, provider_name)
                    continue

                response_text = str(response).strip()
                if not response_text or response_text.lower() == "none":
                    logger.warning("Digest summary empty for channel %s (provider=%s): response='%s'", ch_id, provider_name, response)
                    continue

                summary_sections.append(f"### #{ch_name}\n{response_text}")
                
                # Record analytics for each channel summary
                ch_obj = self.bot.get_channel(int(ch_id))
                ch_name = ch_obj.name if ch_obj else None
                await database.record_event(
                    event_type="digest",
                    guild_id=str(target_guild.id),
                    channel_id=str(ch_id),
                    channel_name=ch_name,
                    provider=provider_name,
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    estimated_cost=estimated_cost,
                    latency_ms=latency
                )
            except Exception as e:
                logger.error(f"Failed to summarize channel {ch_id}: {e}")
                continue

        if not summary_sections:
            if channel_override:
                await channel_override.send("No significant activity found in the last 24 hours to summarize.")
            return

        # Build and send the digest embed
        embed = discord.Embed(
            title="🌞 Daily Community Digest",
            description="\n\n".join(summary_sections),
            color=discord.Color.gold(),
            timestamp=datetime.datetime.now()
        )
        embed.set_footer(text="SparkSage Daily Summary • Stay informed!")
        
        try:
            await target_channel.send(embed=embed)
            logger.info(f"Daily digest successfully posted to #{target_channel.name}")
        except discord.Forbidden:
            logger.error(f"Daily digest error: Missing permissions to send to #{target_channel.name}")

    @app_commands.command(name="digest_test", description="Manually trigger a daily digest for testing")
    @app_commands.check(has_command_permission)
    async def digest_test(self, interaction: discord.Interaction):
        await self._safe_defer(interaction, ephemeral=True)
        await self.run_digest(channel_override=interaction.channel, guild_override=interaction.guild)
        await self._safe_send(interaction, "Digest test completed. Check this channel for the output.", ephemeral=True)

async def setup(bot: commands.Bot):
    await bot.add_cog(Digest(bot))
