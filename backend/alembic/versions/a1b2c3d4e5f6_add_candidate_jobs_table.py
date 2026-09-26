"""Add candidate_jobs table

Revision ID: a1b2c3d4e5f6
Revises: 8c9d0e1f2a3b
Create Date: 2026-09-26 14:40:00.000000

Creates the candidate_jobs table — canonical (organization_id, candidate_id, job_id)
composite-keyed record for the enterprise hiring pipeline.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '8c9d0e1f2a3b'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'candidate_jobs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('organization_id', sa.String(36), sa.ForeignKey('organizations.id'), nullable=False, index=True),
        sa.Column('candidate_id', sa.String(36), sa.ForeignKey('candidates.id'), nullable=False, index=True),
        sa.Column('job_id', sa.String(36), sa.ForeignKey('jobs.id'), nullable=False, index=True),
        sa.Column('job_application_id', sa.String(36), sa.ForeignKey('job_applications.id'), nullable=True, index=True),
        sa.Column('resume_id', sa.String(36), sa.ForeignKey('resumes.id'), nullable=True, index=True),
        sa.Column('source', sa.String(50), nullable=False, server_default='CareerPage'),
        sa.Column('received_at', sa.DateTime(timezone=True), nullable=True),

        # Extraction
        sa.Column('extraction_status', sa.String(20), nullable=False, server_default='QUEUED'),
        sa.Column('extracted_profile', sa.JSON(), nullable=True),
        sa.Column('extraction_model', sa.String(100), nullable=True),
        sa.Column('extraction_error', sa.Text(), nullable=True),
        sa.Column('extraction_completed_at', sa.DateTime(timezone=True), nullable=True),

        # Screening
        sa.Column('screening_status', sa.String(20), nullable=False, server_default='QUEUED'),
        sa.Column('recommendation', sa.String(20), nullable=True),
        sa.Column('screening_score', sa.Float(), nullable=True),
        sa.Column('screening_rationale', sa.Text(), nullable=True),
        sa.Column('screening_criterion_results', sa.JSON(), nullable=True),
        sa.Column('screening_model', sa.String(100), nullable=True),
        sa.Column('screening_error', sa.Text(), nullable=True),
        sa.Column('screening_completed_at', sa.DateTime(timezone=True), nullable=True),

        # Stage
        sa.Column('stage', sa.String(30), nullable=False, server_default='APPLIED'),

        # Workflow
        sa.Column('workflow_execution_id', sa.String(36), sa.ForeignKey('workflow_executions.id'), nullable=True, index=True),

        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),

        sa.UniqueConstraint('organization_id', 'candidate_id', 'job_id', name='uq_candidate_job'),
    )


def downgrade():
    op.drop_table('candidate_jobs')
