from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from api.deps import get_current_user
import db

router = APIRouter()

class FAQCreate(BaseModel):
    guild_id: str
    question: str
    answer: str
    match_keywords: str

class FAQResponse(BaseModel):
    id: int
    guild_id: str
    question: str
    answer: str
    match_keywords: str
    times_used: int
    created_by: str | None
    created_at: str

@router.get("", response_model=list[FAQResponse])
async def list_faqs(user: dict = Depends(get_current_user)):
    database = await db.get_db()
    cursor = await database.execute("SELECT * FROM faqs ORDER BY created_at DESC")
    rows = await cursor.fetchall()
    return [dict(row) for row in rows]

@router.post("", response_model=FAQResponse)
async def create_faq(body: FAQCreate, user: dict = Depends(get_current_user)):
    database = await db.get_db()
    cursor = await database.execute(
        "INSERT INTO faqs (guild_id, question, answer, match_keywords, created_by) VALUES (?, ?, ?, ?, ?)",
        (body.guild_id, body.question, body.answer, body.match_keywords, user.get("sub", "admin"))
    )
    faq_id = cursor.lastrowid
    await database.commit()
    
    # Fetch the newly created FAQ
    cursor = await database.execute("SELECT * FROM faqs WHERE id = ?", (faq_id,))
    row = await cursor.fetchone()
    return dict(row)

@router.delete("/{faq_id}")
async def delete_faq(faq_id: int, user: dict = Depends(get_current_user)):
    database = await db.get_db()
    await database.execute("DELETE FROM faqs WHERE id = ?", (faq_id,))
    await database.commit()
    return {"status": "ok"}
