"""add_ai_call_batches_and_batch_id_to_call_attempts

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-26 21:40:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create ai_call_batches table first (call_attempts references it)
    op.create_table(
        'ai_call_batches',
        sa.Column('id', sa.String(36), nullable=False),
        sa.Column('organization_id', sa.String(36), nullable=False),
        sa.Column('job_id', sa.String(36), nullable=False),
        sa.Column('workflow_id', sa.String(36), nullable=True),
        sa.Column('workflow_version_id', sa.String(36), nullable=True),
        sa.Column('started_by_id', sa.String(36), nullable=False),
        sa.Column('status', sa.String(30), nullable=False, server_default='QUEUED'),
        sa.Column('total_candidates', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('initiated_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('completed_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('failed_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('skipped_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('max_concurrent_calls', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('call_delay_seconds', sa.Integer(), nullable=False, server_default='10'),
        sa.Column('max_attempts_per_candidate', sa.Integer(), nullable=False, server_default='2'),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('error_summary', sa.JSON(), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('paused_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id']),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id']),
        sa.ForeignKeyConstraint(['started_by_id'], ['users.id']),
        sa.ForeignKeyConstraint(['workflow_id'], ['workflows.id']),
        sa.ForeignKeyConstraint(['workflow_version_id'], ['workflow_versions.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_ai_call_batches_organization_id', 'ai_call_batches', ['organization_id'])
    op.create_index('ix_ai_call_batches_job_id', 'ai_call_batches', ['job_id'])
    op.create_index('ix_ai_call_batches_status', 'ai_call_batches', ['status'])
    op.create_index('ix_ai_call_batches_workflow_id', 'ai_call_batches', ['workflow_id'])

    # Add batch_id column to call_attempts (SQLite: simple ADD COLUMN, no batch_alter_table)
    op.execute("ALTER TABLE call_attempts ADD COLUMN batch_id VARCHAR(36) REFERENCES ai_call_batches(id)")
    try:
        op.create_index('ix_call_attempts_batch_id', 'call_attempts', ['batch_id'])
    except Exception:
        pass  # index may already exist


def downgrade() -> None:
    with op.batch_alter_table('call_attempts', schema=None) as batch_op:
        batch_op.drop_index('ix_call_attempts_batch_id')
        batch_op.drop_column('batch_id')

    op.drop_index('ix_ai_call_batches_workflow_id', 'ai_call_batches')
    op.drop_index('ix_ai_call_batches_status', 'ai_call_batches')
    op.drop_index('ix_ai_call_batches_job_id', 'ai_call_batches')
    op.drop_index('ix_ai_call_batches_organization_id', 'ai_call_batches')
    op.drop_table('ai_call_batches')
