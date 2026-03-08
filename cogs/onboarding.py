from discord.ext import commands
import discord
import db as database
import config

class Onboarding(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        guild_id = str(member.guild.id)
        enabled = await database.get_effective_config("WELCOME_ENABLED", guild_id=guild_id, default="0")
        if enabled != "1":
            return
            
        channel_id = await database.get_effective_config("WELCOME_CHANNEL_ID", guild_id=guild_id)
        welcome_template = await database.get_effective_config(
            "WELCOME_MESSAGE", 
            guild_id=guild_id,
            default="Welcome {user} to {server}! We're glad to have you here. Check out the rules and feel free to ask me any questions."
        )
        
        message = welcome_template.format(user=member.mention, server=member.guild.name)
        
        # Send to channel if configured
        if channel_id:
            channel = member.guild.get_channel(int(channel_id))
            if channel:
                await channel.send(message)
        
        # Also send a DM
        try:
            await member.send(f"Welcome to **{member.guild.name}**!\n\n{message}")
        except discord.Forbidden:
            pass # Could not DM user

async def setup(bot):
    await bot.add_cog(Onboarding(bot))
