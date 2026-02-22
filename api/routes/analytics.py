from __future__ import annotations

from fastapi import APIRouter, Depends
from api.deps import get_current_user
import db

router = APIRouter()

@router.get("/summary")
async def get_analytics_summary(user: dict = Depends(get_current_user)):
    """Return high-level analytics summary."""
    database = await db.get_db()
    
    # Total messages/events
    cursor = await database.execute("SELECT COUNT(*) as count FROM analytics")
    total_events = (await cursor.fetchone())["count"]
    
    # Total tokens
    cursor = await database.execute("SELECT SUM(tokens_used) as total FROM analytics")
    total_tokens = (await cursor.fetchone())["total"] or 0
    
    # Provider distribution
    cursor = await database.execute(
        "SELECT provider, COUNT(*) as count FROM analytics GROUP BY provider"
    )
    providers = [dict(row) for row in await cursor.fetchall()]
    
    # Avg latency
    cursor = await database.execute("SELECT AVG(latency_ms) as avg FROM analytics")
    avg_latency = (await cursor.fetchone())["avg"] or 0
    
    return {
        "total_events": total_events,
        "total_tokens": total_tokens,
        "avg_latency_ms": round(avg_latency, 2),
        "providers": providers
    }

@router.get("/history")
async def get_analytics_history(days: int = 7, user: dict = Depends(get_current_user)):
    """Return historical data for charts, specifically tracking message volume."""
    database = await db.get_db()
    
    # Messages per day (mentions and commands)
    cursor = await database.execute(
        """
        SELECT 
            date(created_at) as day, 
            COUNT(CASE WHEN event_type IN ('mention', 'command') THEN 1 END) as messages,
            COUNT(*) as total_events,
            AVG(latency_ms) as avg_latency
        FROM analytics 
        WHERE created_at > date('now', ?)
        GROUP BY day 
        ORDER BY day ASC
        """,
        (f"-{days} days",)
    )
    daily_stats = [dict(row) for row in await cursor.fetchall()]
    
    # Top channels by message volume
    cursor = await database.execute(
        """
        SELECT channel_id, COUNT(*) as count 
        FROM analytics 
        WHERE event_type IN ('mention', 'command')
        GROUP BY channel_id 
        ORDER BY count DESC 
        LIMIT 5
        """
    )
    top_channels = [dict(row) for row in await cursor.fetchall()]
    
    return {
        "daily": daily_stats,
        "top_channels": top_channels
    }

@router.get("/test-data")
async def get_analytics_test_data(user: dict = Depends(get_current_user)):
    """Return hardcoded test data for debugging UI."""
    return {
        "summary": {
            "total_events": 1234,
            "total_tokens": 56789,
            "avg_latency_ms": 1250.5,
            "providers": [
                {"provider": "gemini", "count": 800},
                {"provider": "groq", "count": 300},
                {"provider": "openai", "count": 134}
            ]
        },
        "history": {
            "daily": [
                {"day": "2026-02-14", "count": 100, "avg_latency": 1100},
                {"day": "2026-02-15", "count": 150, "avg_latency": 1200},
                {"day": "2026-02-16", "count": 200, "avg_latency": 1150},
                {"day": "2026-02-17", "count": 180, "avg_latency": 1300},
                {"day": "2026-02-18", "count": 250, "avg_latency": 1250},
                {"day": "2026-02-19", "count": 300, "avg_latency": 1400},
                {"day": "2026-02-20", "count": 350, "avg_latency": 1350}
            ],
            "top_channels": [
                {"channel_id": "General", "count": 500},
                {"channel_id": "Bot-spam", "count": 300},
                {"channel_id": "Dev", "count": 200},
                {"channel_id": "Lounge", "count": 150},
                {"channel_id": "Mod", "count": 84}
            ]
        }
    }
