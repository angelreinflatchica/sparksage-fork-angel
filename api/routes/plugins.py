from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
import asyncio
from pydantic import BaseModel
from api.deps import get_current_user
import db
from bot import bot

router = APIRouter()

class PluginToggleRequest(BaseModel):
    id: str
    enabled: bool

@router.get("/")
async def get_plugins(user: dict = Depends(get_current_user)):
    # Scan for new plugins first
    await bot.plugin_manager.scan_plugins()
    plugins = await db.get_plugins()
    return {"plugins": plugins}

@router.post("/toggle")
async def toggle_plugin(body: PluginToggleRequest, user: dict = Depends(get_current_user)):
    await db.set_plugin_state(body.id, body.enabled)
    
    if body.enabled:
        success, message = await bot.plugin_manager.load_plugin(body.id)
    else:
        success, message = await bot.plugin_manager.unload_plugin(body.id)
        
    if not success:
         raise HTTPException(status_code=500, detail=message or f"Failed to {'load' if body.enabled else 'unload'} plugin {body.id}")
    
    # After toggling, we should sync commands globally so they appear everywhere
    await bot.plugin_manager.sync_commands()
         
    return {"status": "ok", "enabled": body.enabled}

@router.post("/{plugin_id}/reload")
async def reload_plugin(plugin_id: str, user: dict = Depends(get_current_user)):
    success, message = await bot.plugin_manager.reload_plugin(plugin_id)
    if not success:
        raise HTTPException(status_code=500, detail=message or f"Failed to reload plugin {plugin_id}")
    
    # Sync after reload
    await asyncio.sleep(1) # Give bot a moment to stabilize
    await bot.plugin_manager.sync_commands()
    return {"status": "ok"}

@router.post("/sync")
async def sync_plugins(user: dict = Depends(get_current_user)):
    """Force-sync all commands globally."""
    success, message = await bot.plugin_manager.sync_commands()
    if not success:
        raise HTTPException(status_code=500, detail=message)
    return {"status": "ok"}
