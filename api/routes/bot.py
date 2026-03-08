from fastapi import APIRouter, Depends, HTTPException
from api.deps import get_current_user

router = APIRouter()


@router.get("/status")
async def bot_status(user: dict = Depends(get_current_user)):
    from bot import get_bot_status
    return get_bot_status()


@router.get("/guilds")
async def bot_guilds(user: dict = Depends(get_current_user)):
    from api.main import get_bot_instance

    bot = get_bot_instance()
    if bot is None:
        raise HTTPException(status_code=503, detail="Discord bot is not running yet.")

    guilds = [
        {
            "id": str(g.id),
            "name": g.name,
            "member_count": g.member_count,
        }
        for g in bot.guilds
    ]
    return {"guilds": guilds}


@router.get("/guilds/{guild_id}/channels")
async def bot_guild_channels(guild_id: str, user: dict = Depends(get_current_user)):
    from api.main import get_bot_instance
    import discord

    bot = get_bot_instance()
    if bot is None:
        raise HTTPException(status_code=503, detail="Discord bot is not running yet.")

    guild_id_clean = guild_id.strip()
    if not guild_id_clean.isdigit():
        raise HTTPException(status_code=400, detail="Invalid guild id.")

    guild_int = int(guild_id_clean)
    guild = bot.get_guild(guild_int)
    if guild is None:
        guild = next((g for g in bot.guilds if g.id == guild_int), None)

    if guild is None:
        raise HTTPException(status_code=404, detail="Guild not found.")

    # Prefer cache; fallback to API fetch when cache is empty.
    text_channels = list(guild.text_channels)
    if not text_channels:
        try:
            fetched = await guild.fetch_channels()
            text_channels = [
                ch for ch in fetched if isinstance(ch, discord.TextChannel)
            ]
        except Exception:
            text_channels = []

    # Only include channels visible to the bot to prevent unusable selections.
    me = guild.me
    if me is not None:
        text_channels = [ch for ch in text_channels if ch.permissions_for(me).view_channel]

    channels = sorted(
        [{"id": str(ch.id), "name": ch.name, "type": "text"} for ch in text_channels],
        key=lambda item: item["name"].lower(),
    )
    return {"channels": channels}
