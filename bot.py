from __future__ import annotations

import asyncio
import discord
from discord.ext import commands
from discord import app_commands
import config
import providers
import db as database
import os
import traceback
from cogs.prompts import get_channel_prompt
from cogs.channel_providers import get_channel_provider
from utils.rate_limiter import limiter
from plugin_manager import PluginManager

intents = discord.Intents.default()
intents.message_content = True
intents.members = True 

class SparkSageBot(commands.Bot):
    def __init__(self):
        # Allow bot to be triggered by prefix OR mention
        super().__init__(
            command_prefix=commands.when_mentioned_or(config.BOT_PREFIX), 
            intents=intents
        )
        self.plugin_manager = PluginManager(self)

    async def setup_hook(self):
        # Scan and load plugins
        print("--- Loading Plugins ---")
        await self.plugin_manager.scan_plugins()
        await self.plugin_manager.load_enabled_plugins()

        # Load cogs
        print("--- Loading Cogs ---")
        cogs = [
            "cogs.general",
            "cogs.summarize",
            "cogs.code_review",
            "cogs.faq",
            "cogs.onboarding",
            "cogs.permissions",
            "cogs.digest",
            "cogs.moderation",
            "cogs.translate",
            "cogs.prompts",
            "cogs.channel_providers",
            "cogs.plugins",
            "cogs.feedback",
        ]
        for cog in cogs:
            try:
                await self.load_extension(cog)
                print(f"Loaded extension: {cog}")
            except Exception as e:
                traceback.print_exc()
                print(f"Failed to load extension {cog}: {e}")

        # Sync slash commands
        try:
            print("Syncing global slash commands...")
            synced = await self.tree.sync()
            print(f"Globally synced {len(synced)} slash command(s)")
        except Exception as e:
            print(f"Failed to sync global commands: {e}")

    async def _sync_commands_on_loop(self, guild_id: int | None = None) -> tuple[bool, str]:
        """Helper to sync commands directly on the bot's event loop."""
        try:
            if guild_id:
                guild = self.get_guild(guild_id)
                if guild:
                    # Clear existing guild commands first to prevent duplicates
                    try:
                        self.tree.clear_commands(guild=guild)
                    except Exception:
                        pass
                    self.tree.copy_global_to(guild=guild)
                    await self.tree.sync(guild=guild)
                    return True, ""
                return False, f"Guild {guild_id} not found."
            else:
                await self.tree.sync()
                return True, ""
        except Exception as e:
            return False, str(e)

bot = SparkSageBot()

MAX_HISTORY = 20

async def ask_ai(channel_id: int, user_name: str, message: str, guild_id: int | None = None, user_id: int | None = None) -> tuple[str, str]:
    """Send a message to AI and return (response, provider_name)."""
    # Store user message in DB
    await database.add_message(str(channel_id), "user", f"{user_name}: {message}")

    messages = await database.get_messages(str(channel_id), limit=MAX_HISTORY)
    history = [{"role": m["role"], "content": m["content"]} for m in messages]

    # Check for channel-specific prompt override
    channel_prompt = await get_channel_prompt(str(channel_id))
    active_prompt = channel_prompt if channel_prompt else config.SYSTEM_PROMPT

    # Check for channel-specific provider override
    channel_provider = await get_channel_provider(str(channel_id))

    try:
        # Run blocking chat in thread
        response, provider_name, input_tokens, output_tokens, estimated_cost, latency = await asyncio.to_thread(
            providers.chat, history, active_prompt, override_primary=channel_provider
        )

        # Record analytics
        await database.record_event(
            event_type="mention",
            guild_id=str(guild_id) if guild_id else None,
            channel_id=str(channel_id),
            user_id=str(user_id) if user_id else None,
            provider=provider_name,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            estimated_cost=estimated_cost,
            latency_ms=latency
        )

        # Store assistant response in DB
        await database.add_message(str(channel_id), "assistant", response, provider=provider_name)
        return response, provider_name
    except Exception as e:
        return f"Sorry, AI request failed: {e}", "none"


@bot.event
async def on_command_error(ctx, error):
    """Silently ignore unknown prefix commands to avoid noisy tracebacks.

    Users often type plain words after mentioning the bot (e.g., "@SparkSage hello").
    `when_mentioned_or` treats the mention as a prefix and attempts to find a
    command named "hello". Ignore `CommandNotFound` to suppress expected noise.
    """
    from discord.ext.commands import CommandNotFound

    if isinstance(error, CommandNotFound):
        return
    # For other errors, re-raise so default logging still occurs
    raise error


def get_bot_status() -> dict:
    """Return bot status info for the dashboard API."""
    if bot.is_ready():
        return {
            "online": True,
            "username": str(bot.user),
            "latency_ms": round(bot.latency * 1000, 1),
            "guild_count": len(bot.guilds),
            "guilds": [{"id": str(g.id), "name": g.name, "member_count": g.member_count} for g in bot.guilds],
        }
    return {"online": False, "username": None, "latency_ms": None, "guild_count": 0, "guilds": []}


# --- Events ---


@bot.event
async def on_ready():
    available = providers.get_available_providers()
    primary = config.AI_PROVIDER
    provider_info = config.PROVIDERS.get(primary, {})

    print(f"SparkSage is online as {bot.user}")
    print(f"Primary provider: {provider_info.get('name', primary)} ({provider_info.get('model', '?')})")
    print(f"Fallback chain: {' -> '.join(available)}")
    print(f"Commands loaded: {[cmd.name for cmd in bot.tree.get_commands()]}")


@bot.event
async def on_message(message: discord.Message):
    if message.author == bot.user:
        return

    # Respond when mentioned
    if bot.user in message.mentions:
        # 1. Guild Rate Limit
        if message.guild:
            try:
                guild_limit_str = await database.get_config("RATE_LIMIT_GUILD", str(config.RATE_LIMIT_GUILD))
                guild_limit = int(guild_limit_str)
                limited, retry = await limiter.is_rate_limited(str(message.guild.id), guild_limit, is_guild=True)
                if limited:
                    await message.reply(f"⚠️ This server has reached its AI request limit. Please try again in {retry}s.")
                    return
            except:
                pass

        # 2. User Rate Limit
        try:
            user_limit_str = await database.get_config("RATE_LIMIT_USER", str(config.RATE_LIMIT_USER))
            user_limit = int(user_limit_str)
            limited, retry = await limiter.is_rate_limited(str(message.author.id), user_limit)
            if limited:
                await message.reply(f"⏳ You're sending requests too fast! Please wait {retry}s.")
                return
        except:
            pass

        clean_content = message.content.replace(f"<@{bot.user.id}>", "").replace(f"<@!{bot.user.id}>", "").strip()
        if not clean_content:
            clean_content = "Hello!"

        async with message.channel.typing():
            response, provider_name = await ask_ai(
                message.channel.id, 
                message.author.display_name, 
                clean_content,
                guild_id=message.guild.id if message.guild else None,
                user_id=message.author.id
            )

        # Split long responses (Discord 2000 char limit)
        for i in range(0, len(response), 2000):
            try:
                await message.reply(response[i : i + 2000])
            except:
                # If reply fails (e.g. message deleted), just try sending to channel
                await message.channel.send(response[i : i + 2000])

    await bot.process_commands(message)


@bot.command()
async def ping(ctx):
    """Verify the bot is responsive."""
    await ctx.send(f"Pong! Latency: {round(bot.latency * 1000)}ms")


@bot.command()
async def debug(ctx):
    """Print debug info about loaded commands and cogs."""
    loaded_cogs = list(bot.cogs.keys())
    slash_commands = [cmd.name for cmd in bot.tree.get_commands()]
    extensions = list(bot.extensions.keys())
    # Fetch commands as registered on Discord (global and guild) to inspect duplicates
    try:
        global_cmds = await bot.tree.fetch_commands()
    except Exception:
        global_cmds = []

    try:
        guild_cmds = await bot.tree.fetch_commands(guild=ctx.guild)
    except Exception:
        guild_cmds = []

    def fmt(cmd):
        try:
            return f"{cmd.name}({getattr(cmd, 'id', 'no-id')})"
        except Exception:
            return str(cmd)

    msg = f"**Debug Info:**\n"
    msg += f"- **Prefix:** `{config.BOT_PREFIX}`\n"
    msg += f"- **Bot User ID:** `{bot.user.id if bot.user else 'unknown'}`\n"
    msg += f"- **Application ID:** `{bot.application_id}`\n"
    msg += f"- **Cogs:** `{', '.join(loaded_cogs)}`\n"
    msg += f"- **Extensions:** `{', '.join(extensions)}`\n"
    msg += f"- **Slash Commands (local tree):** `{', '.join(slash_commands)}`\n"
    msg += f"- **Global Commands ({len(global_cmds)}):** `{', '.join([fmt(c) for c in global_cmds])}`\n"
    msg += f"- **Guild Commands ({len(guild_cmds)}):** `{', '.join([fmt(c) for c in guild_cmds])}`"
    await ctx.send(msg)


@bot.command()
async def sync(ctx):
    """Manually sync slash commands to the current guild and clear duplicates."""
    print(f"Sync command triggered by {ctx.author} in guild {ctx.guild}")
    try:
        await ctx.send("🔄 Cleaning and syncing commands... please wait.")
        
        # 1. Clear guild-specific commands first to prevent duplicates
        bot.tree.clear_commands(guild=ctx.guild)
        await bot.tree.sync(guild=ctx.guild)
        
        # 2. Copy global commands to this guild
        bot.tree.copy_global_to(guild=ctx.guild)
        
        # 3. Sync everything
        synced = await bot.tree.sync(guild=ctx.guild)
        
        await ctx.send(f"✅ **Sync Complete!**\n- Synced `{len(synced)}` clean commands to this server.\n\nCommands: `{', '.join([s.name for s in synced])}`")
        print(f"Clean synced {len(synced)} commands to {ctx.guild.name}")
    except Exception as e:
        traceback.print_exc()
        await ctx.send(f"❌ **Failed to sync:**\n`{e}`")


# --- Run ---


def main():
    if not config.DISCORD_TOKEN:
        print("Error: DISCORD_TOKEN not set. Copy .env.example to .env and fill in your tokens.")
        return

    available = providers.get_available_providers()
    if not available:
        print("Error: No AI providers configured. Add at least one API key to .env")
        return

    bot.run(config.DISCORD_TOKEN)


if __name__ == "__main__":
    main()
