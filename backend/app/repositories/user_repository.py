from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import User


class UserRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create(
        self,
        user_id: str,
        email: str | None = None,
        touch_guest_session: bool = False,
    ) -> User:
        result = await self.db.execute(
            select(User).where(User.id == user_id).with_for_update()
        )
        user = result.scalar_one_or_none()

        if user is None:
            user = User(id=user_id, email=email)
            self.db.add(user)
        elif email and user.email != email:
            user.email = email
        if touch_guest_session and user_id.startswith("guest-"):
            user.created_at = datetime.now(timezone.utc)

        await self.db.commit()
        await self.db.refresh(user)
        return user
