"""configurable_hiring_workflow_and_elevenlabs

Revision ID: 7a8b9c0d1e2f
Revises: 61fd525e58e8
Create Date: 2026-09-26 10:05:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '7a8b9c0d1e2f'
down_revision: Union[str, None] = '61fd525e58e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. Workflows
    op.create_table(
        'workflows',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('organization_id', sa.String(length=36), nullable=False),
        sa.Column('created_by_id', sa.String(length=36), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_company_default', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='Active'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id']),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_workflows_organization_id'), 'workflows', ['organization_id'], unique=False)

    # 2. Workflow Versions
    op.create_table(
        'workflow_versions',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('workflow_id', sa.String(length=36), nullable=False),
        sa.Column('organization_id', sa.String(length=36), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('publication_state', sa.String(length=50), nullable=False, server_default='Draft'),
        sa.Column('definition_checksum', sa.String(length=64), nullable=True),
        sa.Column('graph_data', sa.JSON(), nullable=False),
        sa.Column('validation_errors', sa.JSON(), nullable=True),
        sa.Column('rubric_version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('prompt_policy_version', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('published_by_id', sa.String(length=36), nullable=True),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id']),
        sa.ForeignKeyConstraint(['published_by_id'], ['users.id']),
        sa.ForeignKeyConstraint(['workflow_id'], ['workflows.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('workflow_id', 'version_number', name='uq_workflow_version_number')
    )
    op.create_index(op.f('ix_workflow_versions_organization_id'), 'workflow_versions', ['organization_id'], unique=False)
    op.create_index(op.f('ix_workflow_versions_workflow_id'), 'workflow_versions', ['workflow_id'], unique=False)

    # 3. Job Workflow Bindings
    op.create_table(
        'job_workflow_bindings',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('job_id', sa.String(length=36), nullable=False),
        sa.Column('workflow_id', sa.String(length=36), nullable=False),
        sa.Column('workflow_version_id', sa.String(length=36), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('bound_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id']),
        sa.ForeignKeyConstraint(['workflow_id'], ['workflows.id']),
        sa.ForeignKeyConstraint(['workflow_version_id'], ['workflow_versions.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('job_id', 'workflow_id', name='uq_job_workflow')
    )
    op.create_index(op.f('ix_job_workflow_bindings_job_id'), 'job_workflow_bindings', ['job_id'], unique=False)
    op.create_index(op.f('ix_job_workflow_bindings_workflow_id'), 'job_workflow_bindings', ['workflow_id'], unique=False)

    # 4. Workflow Executions
    op.create_table(
        'workflow_executions',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('organization_id', sa.String(length=36), nullable=False),
        sa.Column('job_application_id', sa.String(length=36), nullable=False),
        sa.Column('workflow_id', sa.String(length=36), nullable=False),
        sa.Column('workflow_version_id', sa.String(length=36), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='Pending'),
        sa.Column('current_node_id', sa.String(length=100), nullable=True),
        sa.Column('context_data', sa.JSON(), nullable=False),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('paused_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('pause_reason', sa.String(length=255), nullable=True),
        sa.Column('canceled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('cancel_reason', sa.String(length=255), nullable=True),
        sa.Column('worker_lease_id', sa.String(length=100), nullable=True),
        sa.Column('worker_lease_expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['job_application_id'], ['job_applications.id']),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id']),
        sa.ForeignKeyConstraint(['workflow_id'], ['workflows.id']),
        sa.ForeignKeyConstraint(['workflow_version_id'], ['workflow_versions.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('job_application_id')
    )
    op.create_index(op.f('ix_workflow_executions_organization_id'), 'workflow_executions', ['organization_id'], unique=False)
    op.create_index(op.f('ix_workflow_executions_status'), 'workflow_executions', ['status'], unique=False)
    op.create_index(op.f('ix_workflow_executions_workflow_id'), 'workflow_executions', ['workflow_id'], unique=False)
    op.create_index(op.f('ix_workflow_executions_workflow_version_id'), 'workflow_executions', ['workflow_version_id'], unique=False)

    # 5. Node Executions
    op.create_table(
        'node_executions',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('workflow_execution_id', sa.String(length=36), nullable=False),
        sa.Column('node_id', sa.String(length=100), nullable=False),
        sa.Column('node_type', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='Pending'),
        sa.Column('attempt_number', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('input_snapshot', sa.JSON(), nullable=True),
        sa.Column('output_snapshot', sa.JSON(), nullable=True),
        sa.Column('selected_outcome', sa.String(length=100), nullable=True),
        sa.Column('error_details', sa.Text(), nullable=True),
        sa.Column('scheduled_for', sa.DateTime(timezone=True), nullable=True),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['workflow_execution_id'], ['workflow_executions.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_node_executions_node_id'), 'node_executions', ['node_id'], unique=False)
    op.create_index(op.f('ix_node_executions_status'), 'node_executions', ['status'], unique=False)
    op.create_index(op.f('ix_node_executions_workflow_execution_id'), 'node_executions', ['workflow_execution_id'], unique=False)

    # 6. Human Tasks
    op.create_table(
        'human_tasks',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('organization_id', sa.String(length=36), nullable=False),
        sa.Column('workflow_execution_id', sa.String(length=36), nullable=False),
        sa.Column('node_execution_id', sa.String(length=36), nullable=False),
        sa.Column('task_type', sa.String(length=100), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('instructions', sa.Text(), nullable=True),
        sa.Column('assigned_to_id', sa.String(length=36), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='Pending'),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('outcome', sa.String(length=100), nullable=True),
        sa.Column('outcome_data', sa.JSON(), nullable=True),
        sa.Column('completed_by_id', sa.String(length=36), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['assigned_to_id'], ['users.id']),
        sa.ForeignKeyConstraint(['completed_by_id'], ['users.id']),
        sa.ForeignKeyConstraint(['node_execution_id'], ['node_executions.id']),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id']),
        sa.ForeignKeyConstraint(['workflow_execution_id'], ['workflow_executions.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_human_tasks_organization_id'), 'human_tasks', ['organization_id'], unique=False)
    op.create_index(op.f('ix_human_tasks_status'), 'human_tasks', ['status'], unique=False)
    op.create_index(op.f('ix_human_tasks_workflow_execution_id'), 'human_tasks', ['workflow_execution_id'], unique=False)

    # 7. Workflow Events Outbox
    op.create_table(
        'workflow_events',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('organization_id', sa.String(length=36), nullable=False),
        sa.Column('workflow_execution_id', sa.String(length=36), nullable=False),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=50), nullable=False, server_default='Pending'),
        sa.Column('payload', sa.JSON(), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id']),
        sa.ForeignKeyConstraint(['workflow_execution_id'], ['workflow_executions.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_workflow_events_organization_id'), 'workflow_events', ['organization_id'], unique=False)
    op.create_index(op.f('ix_workflow_events_status'), 'workflow_events', ['status'], unique=False)

    # 8. Call Attempts
    op.create_table(
        'call_attempts',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('organization_id', sa.String(length=36), nullable=False),
        sa.Column('workflow_execution_id', sa.String(length=36), nullable=True),
        sa.Column('node_execution_id', sa.String(length=36), nullable=True),
        sa.Column('candidate_id', sa.String(length=36), nullable=False),
        sa.Column('job_id', sa.String(length=36), nullable=False),
        sa.Column('phone_number', sa.String(length=50), nullable=False),
        sa.Column('attempt_number', sa.Integer(), nullable=False, server_default='1'),
        sa.Column('idempotency_key', sa.String(length=255), nullable=False),
        sa.Column('operation_state', sa.String(length=50), nullable=False, server_default='Scheduled'),
        sa.Column('connection_state', sa.String(length=50), nullable=False, server_default='Unknown'),
        sa.Column('disposition', sa.String(length=50), nullable=True),
        sa.Column('processing_state', sa.String(length=50), nullable=False, server_default='AwaitingTranscript'),
        sa.Column('provider', sa.String(length=50), nullable=False, server_default='ElevenLabs'),
        sa.Column('provider_call_id', sa.String(length=255), nullable=True),
        sa.Column('provider_conversation_id', sa.String(length=255), nullable=True),
        sa.Column('agent_id', sa.String(length=255), nullable=True),
        sa.Column('voice_id', sa.String(length=255), nullable=True),
        sa.Column('duration_seconds', sa.Integer(), nullable=True),
        sa.Column('cost_cents', sa.Integer(), nullable=True),
        sa.Column('error_details', sa.Text(), nullable=True),
        sa.Column('scheduled_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('initiated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('ended_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['candidate_id'], ['candidates.id']),
        sa.ForeignKeyConstraint(['job_id'], ['jobs.id']),
        sa.ForeignKeyConstraint(['node_execution_id'], ['node_executions.id']),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id']),
        sa.ForeignKeyConstraint(['workflow_execution_id'], ['workflow_executions.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('idempotency_key')
    )
    op.create_index(op.f('ix_call_attempts_candidate_id'), 'call_attempts', ['candidate_id'], unique=False)
    op.create_index(op.f('ix_call_attempts_job_id'), 'call_attempts', ['job_id'], unique=False)
    op.create_index(op.f('ix_call_attempts_organization_id'), 'call_attempts', ['organization_id'], unique=False)
    op.create_index(op.f('ix_call_attempts_phone_number'), 'call_attempts', ['phone_number'], unique=False)
    op.create_index(op.f('ix_call_attempts_provider_call_id'), 'call_attempts', ['provider_call_id'], unique=False)
    op.create_index(op.f('ix_call_attempts_provider_conversation_id'), 'call_attempts', ['provider_conversation_id'], unique=False)

    # 9. Call Transcripts
    op.create_table(
        'call_transcripts',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('call_attempt_id', sa.String(length=36), nullable=False),
        sa.Column('full_transcript_text', sa.Text(), nullable=False),
        sa.Column('turns', sa.JSON(), nullable=False),
        sa.Column('raw_provider_payload', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['call_attempt_id'], ['call_attempts.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('call_attempt_id')
    )

    # 10. Call Evaluations
    op.create_table(
        'call_evaluations',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('call_attempt_id', sa.String(length=36), nullable=False),
        sa.Column('candidate_statements', sa.JSON(), nullable=False),
        sa.Column('extracted_facts', sa.JSON(), nullable=False),
        sa.Column('question_coverage', sa.JSON(), nullable=False),
        sa.Column('recommendation', sa.String(length=50), nullable=True),
        sa.Column('rationale', sa.Text(), nullable=True),
        sa.Column('human_override', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['call_attempt_id'], ['call_attempts.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('call_attempt_id')
    )

    # 11. Candidate Contact Preferences
    op.create_table(
        'candidate_contact_preferences',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('organization_id', sa.String(length=36), nullable=False),
        sa.Column('candidate_id', sa.String(length=36), nullable=False),
        sa.Column('phone_number', sa.String(length=50), nullable=False),
        sa.Column('stop_contact', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('do_not_call', sa.Boolean(), nullable=False, server_default='0'),
        sa.Column('consent_given', sa.Boolean(), nullable=False, server_default='1'),
        sa.Column('consent_timestamp', sa.DateTime(timezone=True), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['candidate_id'], ['candidates.id']),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organization_id', 'phone_number', name='uq_org_phone_contact_pref')
    )
    op.create_index(op.f('ix_candidate_contact_preferences_organization_id'), 'candidate_contact_preferences', ['organization_id'], unique=False)
    op.create_index(op.f('ix_candidate_contact_preferences_phone_number'), 'candidate_contact_preferences', ['phone_number'], unique=False)

def downgrade() -> None:
    op.drop_table('candidate_contact_preferences')
    op.drop_table('call_evaluations')
    op.drop_table('call_transcripts')
    op.drop_table('call_attempts')
    op.drop_table('workflow_events')
    op.drop_table('human_tasks')
    op.drop_table('node_executions')
    op.drop_table('workflow_executions')
    op.drop_table('job_workflow_bindings')
    op.drop_table('workflow_versions')
    op.drop_table('workflows')
