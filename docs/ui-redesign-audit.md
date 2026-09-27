# CareerOrbitAI UI audit and implementation plan

Baseline: `0f22d2e` (2026-09-26). No repository AGENTS.md is present.

## Architecture and scope

React 19, TypeScript, Vite, React Router and Tailwind 4 frontend; FastAPI,
SQLAlchemy and Alembic backend. SQLite is the default, PostgreSQL is configurable.
Resume files are stored by organization and candidate. API clients cover jobs,
applications, candidate profiles, V3 candidate/job pipelines, workflow execution,
communication policies and ElevenLabs calling. Google OAuth/Forms and Groq are
external dependencies. Background polling advances workflows and form sync.

Routes inspected: public `/careers/:jobCode`, `/apply/:jobCode/:token`; internal
jobs list/create/detail/edit, candidates/profile, workflow list/editor/version/
execution, calling/log detail. Dashboard, AI interviews and settings are placeholders.
The sequential workflow editor already preserves graph branches through an adapter;
keep this representation and API contracts. Add dragging without replacing it.

Authentication uses JWT, but the existing no-token fallback selects/creates a user.
This is a pre-existing production security limitation, not a verified login system.
Three generations of candidate records coexist; do not substitute one for another
or silently combine their counts. Calendar creation, confirmation delivery and
meeting-attending AI interviews are not established by a booked database slot.

## UX findings by area

- Shell: redundant headings, placeholder notifications, no grouping, inconsistent widths.
- Dashboard: no operational view; use database aggregates and actual audit events.
- Jobs: sound sections and mobile cards; unlabeled search, mouse-only titles,
  excessive columns and inconsistent table/empty-state treatment.
- Candidates: dark palette on light shell, unreadable headings, console-only errors,
  fixed first-page state, broken profile deep links and no bulk selection.
- Candidate detail/pipeline: disparate palettes, dense sections, modal focus and
  Escape handling absent. Preserve notes, resume, screening and call details.
- AI calling: gradient hero, decorative emoji and animation, raw provider details,
  failures hidden in console, empty job list leaves loading active, sampled counts
  described as totals, Accepted call state incorrectly included in Completed filter.
- Workflows: consistent sequence concept but no native drag, fake duplicate success,
  hardcoded affected execution count, conditional hooks and stale autosave callback.
- Forms/public intake: retain existing validation and grouping; normalize tokens,
  focus treatment and responsive spacing without changing submission contracts.
- Scheduling/settings: API capability exists without a usable workspace surface.
- Dialogs/tables: share focus management, states, pagination and status presentation.

## Baseline verification

Frontend build passes (647.50 kB main JS, chunk-size warning). Lint fails with 16
conditional-hook errors across StepConfigPanel, InitiateCallModal and CallDetailDrawer.
Backend tests cannot initially collect: requirements omit email-validator. Inspect
imports and add the missing runtime dependencies before running the full suite.
The historical audit report is not current verification evidence.

## Implementation order

1. Shared neutral/navy tokens, controls, badges, states, pagination and modal focus.
2. Grouped navigation and compact shell; genuine dashboard aggregates/activity.
3. Candidate pagination, links, bulk decisions, errors and readable profiles.
4. Simplify AI calling while preserving eligibility, batches, transcripts and controls.
5. Workflow dragging, real duplication, correct counts and stable hooks/autosave.
6. Surface existing communication settings and booked interview information.
7. Build/lint, backend regression tests, desktop/mobile browser and keyboard review.

Live outbound calls, messages and calendar invitations must not be sent as tests.
Use isolated test databases and mocked providers; report external verification gaps.
