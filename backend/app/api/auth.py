from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.security import AuthUser, get_current_user

router = APIRouter(tags=["auth"])


@router.get("/auth/me")
async def current_user_profile(current_user: AuthUser = Depends(get_current_user)) -> dict:
    return {
        "id": current_user.user_id,
        "email": current_user.email,
        "role": current_user.role,
    }
