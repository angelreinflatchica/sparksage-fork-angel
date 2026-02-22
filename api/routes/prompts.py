from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from api.deps import get_current_user
import db

router = APIRouter()

class ChannelPromptUpdate(BaseModel):
    channel_id: str
    guild_id: str
    system_prompt: str

@router.get("")
async def list_channel_prompts(user: dict = Depends(get_current_user)):
    """List all custom channel prompts."""
    database = await db.get_db()
    cursor = await database.execute("SELECT channel_id, guild_id, system_prompt FROM channel_prompts")
    rows = await cursor.fetchall()
    return [{"channel_id": row["channel_id"], "guild_id": row["guild_id"], "system_prompt": row["system_prompt"]} for row in rows]

@router.put("")
async def set_channel_prompt(body: ChannelPromptUpdate, user: dict = Depends(get_current_user)):
    """Set a custom prompt for a channel."""
    database = await db.get_db()
    await database.execute(
        "INSERT INTO channel_prompts (channel_id, guild_id, system_prompt) VALUES (?, ?, ?) "
        "ON CONFLICT(channel_id) DO UPDATE SET system_prompt = excluded.system_prompt",
        (body.channel_id, body.guild_id, body.system_prompt)
    )
    await database.commit()
    return {"status": "ok"}

@router.delete("/{channel_id}")
async def delete_channel_prompt(channel_id: str, user: dict = Depends(get_current_user)):
    """Delete a custom prompt for a channel."""
    database = await db.get_db()
    await database.execute("DELETE FROM channel_prompts WHERE channel_id = ?", (channel_id,))
    await database.commit()
    return {"status": "ok"}
