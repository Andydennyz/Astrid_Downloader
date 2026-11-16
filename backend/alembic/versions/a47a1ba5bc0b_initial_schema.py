"""initial_schema

Revision ID: a47a1ba5bc0b
Revises: 
Create Date: 2026-11-08 13:26:47.881481

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a47a1ba5bc0b'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    existing_tables = set(sa.inspect(op.get_bind()).get_table_names())

    def create_table_if_missing(name: str, *elements) -> None:
        if name not in existing_tables:
            op.create_table(name, *elements)
            existing_tables.add(name)

    create_table_if_missing('users',
    sa.Column('id', sa.String(length=255), nullable=False),
    sa.Column('email', sa.String(length=255), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('email')
    )
    create_table_if_missing('download_jobs',
    sa.Column('id', sa.String(length=255), nullable=False),
    sa.Column('user_id', sa.String(length=255), nullable=False),
    sa.Column('source_url', sa.Text(), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('creator', sa.String(length=255), nullable=False),
    sa.Column('thumbnail_url', sa.Text(), nullable=True),
    sa.Column('duration_sec', sa.Integer(), nullable=False),
    sa.Column('kind', sa.String(length=32), nullable=False),
    sa.Column('extension', sa.String(length=32), nullable=False),
    sa.Column('quality_label', sa.String(length=64), nullable=False),
    sa.Column('priority', sa.String(length=32), nullable=True),
    sa.Column('destination', sa.Text(), nullable=False),
    sa.Column('filename', sa.String(length=255), nullable=True),
    sa.Column('selection_json', sa.Text(), nullable=True),
    sa.Column('status', sa.String(length=64), nullable=False),
    sa.Column('progress', sa.Float(), nullable=False),
    sa.Column('downloaded_bytes', sa.Integer(), nullable=False),
    sa.Column('total_bytes', sa.Integer(), nullable=True),
    sa.Column('speed_bps', sa.Integer(), nullable=True),
    sa.Column('eta_sec', sa.Integer(), nullable=True),
    sa.Column('file_path', sa.Text(), nullable=True),
    sa.Column('error', sa.Text(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
    sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    create_table_if_missing('history_items',
    sa.Column('id', sa.String(length=255), nullable=False),
    sa.Column('user_id', sa.String(length=255), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('creator', sa.String(length=255), nullable=False),
    sa.Column('source_url', sa.Text(), nullable=False),
    sa.Column('thumbnail_url', sa.Text(), nullable=True),
    sa.Column('kind', sa.String(length=32), nullable=False),
    sa.Column('status', sa.String(length=32), nullable=False),
    sa.Column('extension', sa.String(length=32), nullable=False),
    sa.Column('quality_label', sa.String(length=64), nullable=False),
    sa.Column('duration_sec', sa.Integer(), nullable=False),
    sa.Column('size_bytes', sa.Integer(), nullable=True),
    sa.Column('file_path', sa.Text(), nullable=True),
    sa.Column('error', sa.Text(), nullable=True),
    sa.Column('timestamp', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    create_table_if_missing('library_items',
    sa.Column('id', sa.String(length=255), nullable=False),
    sa.Column('user_id', sa.String(length=255), nullable=False),
    sa.Column('title', sa.String(length=255), nullable=False),
    sa.Column('creator', sa.String(length=255), nullable=False),
    sa.Column('filename', sa.String(length=255), nullable=False),
    sa.Column('source_url', sa.Text(), nullable=False),
    sa.Column('thumbnail_url', sa.Text(), nullable=True),
    sa.Column('file_path', sa.Text(), nullable=False),
    sa.Column('kind', sa.String(length=32), nullable=False),
    sa.Column('extension', sa.String(length=32), nullable=False),
    sa.Column('quality_label', sa.String(length=64), nullable=False),
    sa.Column('size_bytes', sa.Integer(), nullable=False),
    sa.Column('duration_sec', sa.Integer(), nullable=False),
    sa.Column('downloaded_at', sa.DateTime(timezone=True), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
    sa.PrimaryKeyConstraint('id')
    )


def downgrade() -> None:
    # This baseline may adopt tables created before Alembic was introduced.
    # Dropping them could destroy existing application data.
    pass
