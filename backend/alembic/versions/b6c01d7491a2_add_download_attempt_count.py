"""add download attempt count

Revision ID: b6c01d7491a2
Revises: a47a1ba5bc0b
Create Date: 2026-11-08 20:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "b6c01d7491a2"
down_revision = "a47a1ba5bc0b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("download_jobs")}
    if "attempt_count" not in columns:
        op.add_column(
            "download_jobs",
            sa.Column("attempt_count", sa.Integer(), server_default="0", nullable=False),
        )


def downgrade() -> None:
    # Preserve the column if it existed before this revision was applied.
    pass
