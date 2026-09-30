# Northstar Mock Test Platform

## Delivery plan

### Phase 1 - Foundation and learner dashboard
- Establish Next.js application structure, design system, responsive shell, and environment configuration.
- Build learner overview: test catalog, progress summaries, activity chart, focus areas, and empty/loading/error states.
- Add a health endpoint and MySQL connection pool for XAMPP.

### Phase 2 - Identity and test catalogue
- Add registration, login, password reset, roles, and session management.
- Add MySQL migrations for users, exams, sections, questions, options, and tags.
- Build searchable test catalogue with filters for language, difficulty, duration, and status.

### Phase 3 - Exam engine
- Implement timed attempts, autosave, question navigation, marked-for-review, keyboard access, and resume support.
- Add server-side answer validation and attempt state transitions so scoring cannot be trusted from the browser.

### Phase 4 - Results and learning loop
- Add score reports, topic breakdowns, answer review, benchmarks, streaks, and progress history.
- Add retake and targeted practice-set generation from weak topics.

### Phase 5 - Admin and operations
- Add question/exam authoring, bulk import, publishing workflow, moderation, user management, and audit logs.
- Add analytics, rate limiting, error monitoring, backups, and production deployment configuration.

## Current assumptions

The attached requirements document was not available as a readable file in the workspace, so Phase 1 uses the product title and common mock-test workflows as the initial contract. The UI is intentionally backed by local fixture data until the requirements and database schema are confirmed.

## Backend foundation

The first Phase 1 data boundary is now available at `/api/exams`. It reads published exams and their published test counts from MySQL, while falling back to launch fixtures when XAMPP has not been initialized. The schema is configuration-driven so adding an exam, edition, subject, topic, rule profile, test series, or entitlement does not require a code change. Authentication sessions and test attempts/results also use MySQL when the persistence tables exist; local in-memory fallback remains available for development without XAMPP.

Initialize the local database from `database/schema.sql`, then load launch records from `database/seed.sql`. The schema preserves the original auto-increment user IDs and adds `user_sessions` and `test_attempts` tables. Re-importing the schema with phpMyAdmin creates missing tables without changing existing user IDs.

Admin APIs and `/admin` require an administrator session. To create the first administrator, set a private `ADMIN_BOOTSTRAP_KEY` in `.env.local`, then POST `displayName`, `email`, and `password` to `/api/auth/bootstrap-admin` with that value in the `x-admin-bootstrap-key` header. The bootstrap endpoint is disabled when the key is unset and refuses creation after an administrator already exists. Admin question, rule, and test creation requests write audit events to `audit_logs`.

## Run locally

1. Install Node.js 20+ and start MySQL through XAMPP.
2. Create a database named `mock_test_platform`.
3. Copy `.env.example` to `.env.local` and set credentials if needed.
4. Run `npm install`, then `npm run dev`.

The API health check is available at `/api/health`.