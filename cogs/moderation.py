from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING

import discord
from discord.ext import commands

import db as database
import config
import providers

if TYPE_CHECKING:
    from bot import bot

logger = logging.getLogger("sparksage.moderation")

class ModerationView(discord.ui.View):
    def __init__(self, message_id: int, channel_id: int, user_id: int, original_msg_id: int):
        super().__init__(timeout=None)
        self.message_id = message_id # The mod log message
        self.channel_id = channel_id # Original message channel
        self.user_id = user_id # Original message author
        self.original_msg_id = original_msg_id # Original message ID

    @discord.ui.button(label="Delete Message", style=discord.ButtonStyle.danger, custom_id="mod_delete")
    async def delete_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.defer(ephemeral=True)
        channel = interaction.guild.get_channel(self.channel_id)
        if channel:
            try:
                msg = await channel.fetch_message(self.original_msg_id)
                await msg.delete()
                await database.update_mod_stat(str(self.original_msg_id), "deleted")
                await interaction.followup.send("Message deleted.", ephemeral=True)
                
                # Update the mod log message
                embed = interaction.message.embeds[0]
                embed.color = discord.Color.dark_grey()
                embed.title = f"✅ Handled: Message Deleted"
                await interaction.message.edit(embed=embed, view=None)
            except discord.NotFound:
                await interaction.response.send_message("Message already deleted.", ephemeral=True)
            except Exception as e:
                import traceback
                traceback.print_exc()
                await interaction.followup.send(f"Error: {e}", ephemeral=True)

    @discord.ui.button(label="Warn User", style=discord.ButtonStyle.secondary, custom_id="mod_warn")
    async def warn_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.defer(ephemeral=True)
        try:
            user = await interaction.guild.fetch_member(self.user_id)
            if user:
                reason = interaction.message.embeds[0].fields[0].value
                await user.send(f"⚠️ **Warning from {interaction.guild.name}**\nYour message was flagged and removed for: {reason}")
                await database.update_mod_stat(str(self.original_msg_id), "warned")
                await interaction.followup.send(f"User {user.display_name} warned.", ephemeral=True)
                
                # Update mod log
                embed = interaction.message.embeds[0]
                embed.title = f"✅ Handled: User Warned"
                await interaction.message.edit(embed=embed, view=None)
        except Exception as e:
            import traceback
            traceback.print_exc()
            await interaction.followup.send(f"Could not warn user: {e}", ephemeral=True)

    @discord.ui.button(label="Dismiss", style=discord.ButtonStyle.success, custom_id="mod_dismiss")
    async def dismiss_button(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.defer(ephemeral=True)
        try:
            await database.update_mod_stat(str(self.original_msg_id), "dismissed")
            await interaction.followup.send("Flag dismissed.", ephemeral=True)
            
            # Update mod log
            embed = interaction.message.embeds[0]
            embed.color = discord.Color.green()
            embed.title = f"✅ Handled: Dismissed"
            await interaction.message.edit(embed=embed, view=None)
        except Exception as e:
            import traceback
            traceback.print_exc()
            await interaction.followup.send(f"Error dismissing flag: {e}", ephemeral=True)


class Moderation(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if message.author.bot or not message.guild:
            return
            
        enabled = await database.get_config("MODERATION_ENABLED", "0")
        if enabled != "1":
            return
            
        mod_log_id_str = await database.get_config("MOD_LOG_CHANNEL_ID")
        if not mod_log_id_str:
            return
            
        try:
            mod_log_id = int(mod_log_id_str)
            mod_log = self.bot.get_channel(mod_log_id)
        except (ValueError, TypeError):
            return

        if not mod_log:
            return

        if message.channel.id == mod_log_id:
            return

        sensitivity = await database.get_config("MODERATION_SENSITIVITY", "medium")

        # Moderation prompt
        prompt = (
            "Analyze the following message for: toxicity, harassment, spam, and server rule violations.\n"
            f"Sensitivity Level: {sensitivity.upper()}\n"
            "Rules: If HIGH sensitivity, flag anything slightly off. If LOW, only flag severe violations.\n"
            "Respond ONLY with a valid JSON object:\n"
            '{"flagged": bool, "reason": str, "severity": "low"|"medium"|"high"}\n\n'
            f"Message: {message.content}"
        )

        try:
            response, provider_name, input_tokens, output_tokens, estimated_cost, latency = providers.chat([{"role": "user", "content": prompt}], "You are a professional Discord moderator assistant.")
            
            # Record analytics for moderation scan
            ch_obj = self.bot.get_channel(message.channel.id)
            ch_name = ch_obj.name if ch_obj else None
            await database.record_event(
                event_type="moderation",
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

            # Clean response for JSON parsing
            clean_res = response.strip()
            if "```json" in clean_res:
                clean_res = clean_res.split("```json")[1].split("```")[0].strip()
            elif "```" in clean_res:
                clean_res = clean_res.split("```")[1].split("```")[0].strip()

            try:
                result = json.loads(clean_res)
            except json.JSONDecodeError:
                logger.error(f"Failed to parse moderation JSON: {response}")
                return

            if result.get("flagged"):
                severity = result.get("severity", "low").upper()
                reason = result.get("reason", "No reason provided")
                
                colors = {
                    "LOW": discord.Color.blue(),
                    "MEDIUM": discord.Color.orange(),
                    "HIGH": discord.Color.red()
                }
                
                embed = discord.Embed(
                    title=f"⚠️ Message Flagged ({severity})",
                    description=f"**Content:**\n{message.content}",
                    color=colors.get(severity, discord.Color.greyple()),
                    timestamp=message.created_at
                )
                embed.set_author(name=f"{message.author} ({message.author.id})", icon_url=message.author.display_avatar.url)
                embed.add_field(name="Reason", value=reason, inline=False)
                embed.add_field(name="Channel", value=message.channel.mention, inline=True)
                embed.add_field(name="Jump Link", value=f"[Go to Message]({message.jump_url})", inline=True)
                
                # Log to DB
                await database.add_mod_stat(
                    guild_id=str(message.guild.id),
                    channel_id=str(message.channel.id),
                    user_id=str(message.author.id),
                    message_id=str(message.id),
                    content=message.content,
                    reason=reason,
                    severity=severity.lower()
                )

                view = ModerationView(
                    message_id=0, # Placeholder
                    channel_id=message.channel.id,
                    user_id=message.author.id,
                    original_msg_id=message.id
                )
                
                sent_log = await mod_log.send(embed=embed, view=view)
                view.message_id = sent_log.id

        except Exception as e:
            logger.error(f"Moderation error: {e}")

async def setup(bot: commands.Bot):
    await bot.add_cog(Moderation(bot))
