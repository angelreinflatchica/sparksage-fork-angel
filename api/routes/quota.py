from fastapi import APIRouter, Depends

import db
from api.deps import get_current_user
from utils.rate_limiter import get_limiter

router = APIRouter()


@router.get("/summary")
async def quota_summary(user: dict = Depends(get_current_user)):
    """Return live in-memory quota utilization snapshot for dashboard monitoring."""
    user_limit_str = await db.get_config("RATE_LIMIT_USER", "5")
    guild_limit_str = await db.get_config("RATE_LIMIT_GUILD", "20")

    try:
        user_limit = max(0, int(user_limit_str))
    except (TypeError, ValueError):
        user_limit = 0

    try:
        guild_limit = max(0, int(guild_limit_str))
    except (TypeError, ValueError):
        guild_limit = 0

    snapshot = await get_limiter().get_quota_snapshot(
        user_limit_per_minute=user_limit,
        guild_limit_per_minute=guild_limit,
        top_n=12,
    )
    return snapshot
