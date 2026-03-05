from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from api.deps import get_current_user
import db
import config

router = APIRouter()

class ChannelProviderUpdate(BaseModel):
    channel_id: str
    guild_id: str
    provider: str

@router.get("")
async def list_channel_providers(user: dict = Depends(get_current_user)):
    """List all custom channel providers."""
    database = await db.get_db()
    cursor = await database.execute("SELECT channel_id, guild_id, provider FROM channel_providers")
    rows = await cursor.fetchall()
    return [{"channel_id": row["channel_id"], "guild_id": row["guild_id"], "provider": row["provider"]} for row in rows]

@router.put("")
async def set_channel_provider(body: ChannelProviderUpdate, user: dict = Depends(get_current_user)):
    """Set a custom provider for a channel."""
    if body.provider.lower() not in config.PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Invalid provider: {body.provider}")

    database = await db.get_db()
    await database.execute(
        "INSERT INTO channel_providers (channel_id, guild_id, provider) VALUES (?, ?, ?) "
        "ON CONFLICT(channel_id) DO UPDATE SET provider = excluded.provider",
        (body.channel_id, body.guild_id, body.provider.lower())
    )
    await database.commit()
    return {"status": "ok"}

@router.delete("/{channel_id}")
async def delete_channel_provider(channel_id: str, user: dict = Depends(get_current_user)):
    """Delete a custom provider for a channel."""
    database = await db.get_db()
    await database.execute("DELETE FROM channel_providers WHERE channel_id = ?", (channel_id,))
    await database.commit()
    return {"status": "ok"}
