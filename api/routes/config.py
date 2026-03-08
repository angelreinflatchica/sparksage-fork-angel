from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from api.deps import get_current_user
import db

router = APIRouter()

GUILD_SCOPED_KEYS = {
    "WELCOME_ENABLED",
    "WELCOME_CHANNEL_ID",
    "WELCOME_MESSAGE",
    "DIGEST_ENABLED",
    "DIGEST_CHANNEL_ID",
    "DIGEST_TIME",
    "MODERATION_ENABLED",
    "MOD_LOG_CHANNEL_ID",
    "MODERATION_SENSITIVITY",
    "TRANSLATE_AUTO_ENABLED",
    "TRANSLATE_AUTO_CHANNEL_ID",
    "TRANSLATE_AUTO_TARGET",
}

# Keys that contain secrets and should be masked in GET responses
SENSITIVE_KEYS = {
    "DISCORD_TOKEN",
    "GEMINI_API_KEY",
    "GROQ_API_KEY",
    "OPENROUTER_API_KEY",
    "ANTHROPIC_API_KEY",
    "OPENAI_API_KEY",
    "JWT_SECRET",
    "ADMIN_PASSWORD",
    "DISCORD_CLIENT_SECRET",
}


def mask_value(key: str, value: str) -> str:
    """Mask sensitive values, showing only the last 4 chars."""
    if key in SENSITIVE_KEYS and value and len(value) > 4:
        return "***" + value[-4:]
    return value


class ConfigUpdate(BaseModel):
    values: dict[str, str]


@router.get("")
async def get_config(
    guild_id: str | None = Query(default=None),
    user: dict = Depends(get_current_user),
):
    all_config = await db.get_all_config_for_guild(guild_id) if guild_id else await db.get_all_config()
    masked = {k: mask_value(k, v) for k, v in all_config.items()}
    return {"config": masked}


@router.put("")
async def update_config(
    body: ConfigUpdate,
    guild_id: str | None = Query(default=None),
    user: dict = Depends(get_current_user),
):
    if guild_id:
        guild_values = {k: v for k, v in body.values.items() if k in GUILD_SCOPED_KEYS}
        global_values = {k: v for k, v in body.values.items() if k not in GUILD_SCOPED_KEYS}

        await db.set_guild_config_bulk(guild_id, guild_values)
        if global_values:
            await db.set_config_bulk(global_values)
            await _reload_config()
    else:
        await db.set_config_bulk(body.values)
        # Reload config module from DB values
        await _reload_config()

    return {"status": "ok"}


async def _reload_config():
    """Reload the config module from DB values and rebuild providers."""
    import config as cfg

    all_config = await db.get_all_config()
    cfg.reload_from_db(all_config)

    import providers
    providers.reload_clients()
