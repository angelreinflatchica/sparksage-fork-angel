from __future__ import annotations

import os
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from api.auth import create_token, hash_password, verify_password
from api.deps import get_current_user
import db
import config

router = APIRouter()


class LoginRequest(BaseModel):
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_at: str


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    admin_pw = config.ADMIN_PASSWORD
    if not admin_pw:
        # If no password is set in environment, check DB for one
        db_pw = await db.get_config("ADMIN_PASSWORD")
        if db_pw:
            admin_pw = db_pw

    if not admin_pw:
        raise HTTPException(status_code=400, detail="No admin password configured. Set ADMIN_PASSWORD in .env")

    # Support both plain text and hashed passwords for flexibility
    is_valid = False
    if admin_pw and "$" in admin_pw:
        is_valid = verify_password(body.password, admin_pw)
    else:
        is_valid = (body.password == admin_pw)

    if not is_valid:
        raise HTTPException(status_code=401, detail="Invalid password")

    token, expires_at = create_token("admin")
    await db.create_session(token, "admin", expires_at)
    return TokenResponse(access_token=token, expires_at=expires_at)


@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    return {"user_id": user["sub"], "role": "admin"}
