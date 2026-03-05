from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from api.deps import get_current_user
import db

router = APIRouter()

class PermissionBase(BaseModel):
    command_name: str
    guild_id: str
    role_id: str

class PermissionResponse(PermissionBase):
    pass

@router.get("", response_model=list[PermissionResponse])
async def list_permissions(user: dict = Depends(get_current_user)):
    database = await db.get_db()
    cursor = await database.execute("SELECT * FROM command_permissions")
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]

@router.post("", response_model=PermissionResponse)
async def create_permission(body: PermissionBase, user: dict = Depends(get_current_user)):
    database = await db.get_db()
    await database.execute(
        "INSERT OR IGNORE INTO command_permissions (command_name, guild_id, role_id) VALUES (?, ?, ?)",
        (body.command_name.lower(), body.guild_id, body.role_id)
    )
    await database.commit()
    return body

@router.delete("/{command_name}/{guild_id}/{role_id}")
async def delete_permission(command_name: str, guild_id: str, role_id: str, user: dict = Depends(get_current_user)):
    database = await db.get_db()
    await database.execute(
        "DELETE FROM command_permissions WHERE command_name = ? AND guild_id = ? AND role_id = ?",
        (command_name.lower(), guild_id, role_id)
    )
    await database.commit()
    return {"status": "ok"}
