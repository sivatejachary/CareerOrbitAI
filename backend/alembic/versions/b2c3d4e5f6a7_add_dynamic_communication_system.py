"""Add dynamic communication system tables

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-26 15:30:00.000000

Creates company_communication_settings, communication_plans, and interview_slots.
Adds stage_id and stage_name to hr_decisions.
Adds communication_plan_id and communication_outcome to call_attempts.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'b2c3d4e5f6a7'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade():
    # 1. company_communication_settings
    op.create_table(
        'company_communication_settings',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('organization_id', sa.String(36), sa.ForeignKey('organizations.id'), unique=True, nullable=False, index=True),
        sa.Column('company_intro', sa.Text(), nullable=False),
        sa.Column('tone', sa.String(50), nullable=False, server_default='Professional'),
        sa.Column('supported_languages', sa.JSON(), nullable=False),
        sa.Column('calling_hours_start', sa.String(10), nullable=False, server_default='09:00'),
        sa.Column('calling_hours_end', sa.String(10), nullable=False, server_default='19:00'),
        sa.Column('timezone', sa.String(50), nullable=False, server_default='Asia/Kolkata'),
        sa.Column('max_retry_attempts', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('min_hours_between_calls', sa.Integer(), nullable=False, server_default='4'),
        sa.Column('contact_policy', sa.JSON(), nullable=False),
        sa.Column('allowed_agent_actions', sa.JSON(), nullable=False),
        sa.Column('default_templates', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )

    # 2. communication_plans
    op.create_table(
        'communication_plans',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('organization_id', sa.String(36), sa.ForeignKey('organizations.id'), nullable=False, index=True),
        sa.Column('candidate_id', sa.String(36), sa.ForeignKey('candidates.id'), nullable=False, index=True),
        sa.Column('job_id', sa.String(36), sa.ForeignKey('jobs.id'), nullable=False, index=True),
        sa.Column('workflow_execution_id', sa.String(36), sa.ForeignKey('workflow_executions.id'), nullable=False, index=True),
        sa.Column('node_execution_id', sa.String(36), sa.ForeignKey('node_executions.id'), nullable=False, index=True),
        sa.Column('purpose', sa.String(50), nullable=False, index=True),
        sa.Column('source_stage_id', sa.String(100), nullable=True),
        sa.Column('source_stage_name', sa.String(255), nullable=True),
        sa.Column('target_stage_id', sa.String(100), nullable=True),
        sa.Column('target_stage_name', sa.String(255), nullable=True),
        sa.Column('required_approval', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('approved_decision_id', sa.String(36), sa.ForeignKey('hr_decisions.id'), nullable=True),
        sa.Column('approved_result', sa.String(50), nullable=True),
        sa.Column('facts_to_mention', sa.JSON(), nullable=False),
        sa.Column('questions_to_ask', sa.JSON(), nullable=False),
        sa.Column('allowed_actions', sa.JSON(), nullable=False),
        sa.Column('forbidden_disclosures', sa.JSON(), nullable=False),
        sa.Column('rendered_opening', sa.Text(), nullable=True),
        sa.Column('rendered_message', sa.Text(), nullable=True),
        sa.Column('dynamic_variables', sa.JSON(), nullable=False),
        sa.Column('completion_requirements', sa.JSON(), nullable=False),
        sa.Column('retry_policy', sa.JSON(), nullable=False),
        sa.Column('status', sa.String(50), nullable=False, server_default='VALIDATED'),
        sa.Column('block_reason', sa.Text(), nullable=True),
        sa.Column('is_dry_run', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('workflow_execution_id', 'node_execution_id', name='uq_comm_plan_exec_node')
    )

    # 3. interview_slots
    op.create_table(
        'interview_slots',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('organization_id', sa.String(36), sa.ForeignKey('organizations.id'), nullable=False, index=True),
        sa.Column('job_id', sa.String(36), sa.ForeignKey('jobs.id'), nullable=True, index=True),
        sa.Column('stage_id', sa.String(100), nullable=True, index=True),
        sa.Column('interviewer_name', sa.String(255), nullable=False),
        sa.Column('interviewer_email', sa.String(255), nullable=False),
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=False, index=True),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('duration_minutes', sa.Integer(), nullable=False, server_default='45'),
        sa.Column('timezone', sa.String(50), nullable=False, server_default='Asia/Kolkata'),
        sa.Column('format', sa.String(50), nullable=False, server_default='Video'),
        sa.Column('meeting_link', sa.String(500), nullable=True),
        sa.Column('is_booked', sa.Boolean(), nullable=False, server_default=sa.false(), index=True),
        sa.Column('booked_candidate_id', sa.String(36), sa.ForeignKey('candidates.id'), nullable=True, index=True),
        sa.Column('booked_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('booking_reference', sa.String(100), nullable=True, unique=True, index=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade():
    op.drop_table('interview_slots')
    op.drop_table('communication_plans')
    op.drop_table('company_communication_settings')
