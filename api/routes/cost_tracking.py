from fastapi import APIRouter, Depends
from datetime import datetime, timedelta
import db
from api.deps import get_current_user

router = APIRouter()


@router.get("/daily_costs")
async def get_daily_costs_route(user: dict = Depends(get_current_user)):
    """
    Retrieve daily estimated costs per AI provider.
    Requires authentication.
    """
    return await db.get_daily_costs()


@router.get("/monthly_projection")
async def get_monthly_projection_route(user: dict = Depends(get_current_user)):
    """
    Calculate projected monthly cost based on current month's usage.
    Requires authentication.
    """
    today = datetime.now()
    start_of_month = today.replace(day=1).strftime("%Y-%m-%d")
    
    current_month_cost = await db.get_total_cost_since(start_of_month)
    
    days_in_month = (datetime(today.year, today.month % 12 + 1, 1) - timedelta(days=1)).day
    days_passed = today.day
    
    if days_passed == 0: # Avoid division by zero if running on the first day very early
        return {"projected_monthly_cost": 0.0, "current_month_cost": 0.0}

    projected_monthly_cost = (current_month_cost / days_passed) * days_in_month
    
    return {
        "projected_monthly_cost": round(projected_monthly_cost, 4),
        "current_month_cost": round(current_month_cost, 4)
    }


@router.get("/summary")
async def get_cost_summary_route(user: dict = Depends(get_current_user)):
    """
    Retrieve a summary of total costs grouped by provider.
    Requires authentication.
    """
    return await db.get_total_cost_by_provider()
