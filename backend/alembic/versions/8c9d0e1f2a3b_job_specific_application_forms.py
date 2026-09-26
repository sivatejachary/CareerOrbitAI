"""job_specific_application_forms

Revision ID: 8c9d0e1f2a3b
Revises: 7a8b9c0d1e2f
Create Date: 2026-09-26 12:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '8c9d0e1f2a3b'
down_revision: Union[str, None] = '7a8b9c0d1e2f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # Add new columns to application_forms
    op.add_column('application_forms', sa.Column('public_token', sa.String(length=64), nullable=True))
    op.add_column('application_forms', sa.Column('token_generated_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('application_forms', sa.Column('allow_public_submissions', sa.Boolean(), server_default='1', nullable=False))
    op.add_column('application_forms', sa.Column('is_primary_website_form', sa.Boolean(), server_default='0', nullable=False))
    op.add_column('application_forms', sa.Column('resume_setup_status', sa.String(length=50), server_default='SetupRequired', nullable=False))
    op.add_column('application_forms', sa.Column('google_resume_question_id', sa.String(length=255), nullable=True))
    op.create_index('ix_application_forms_public_token', 'application_forms', ['public_token'], unique=True)

def downgrade() -> None:
    op.drop_index('ix_application_forms_public_token', table_name='application_forms')
    op.drop_column('application_forms', 'google_resume_question_id')
    op.drop_column('application_forms', 'resume_setup_status')
    op.drop_column('application_forms', 'is_primary_website_form')
    op.drop_column('application_forms', 'allow_public_submissions')
    op.drop_column('application_forms', 'token_generated_at')
    op.drop_column('application_forms', 'public_token')
