# Artemis Monorepo

Artemis is a workforce experience sandbox that brings onboarding, people operations, goal tracking, and time management into a single monorepo. The repository packages a production-ready React application, a typed Hono API, a shared schema library, and Supabase infrastructure so you can iterate quickly without trading off safety.

## Architecture at a Glance

- `apps/frontend` — React Router 7 + Tailwind 4 experience layer with auth, dashboards, and management flows.
- `apps/backend` — Bun-powered Hono API that enforces Supabase Row Level Security and multi-tenant business rules.
- `packages/shared` — Shared Zod schemas, enums, and TypeScript helpers consumed by both apps.
- `supabase` — Migrations, seeds, and local CLI configuration for auth, storage, and Postgres policies.
- `docs`, `scripts`, `tasks` — Product plans, operational scripts, and automation entry points.

## Feature Overview

### Frontend (`apps/frontend`)
- Guided onboarding that completes tenant setup and routes new members to the right workflow.
- Dashboard with workspace health, My Time widget, actionable notifications, and theme switching.
- **Core HR & Employee Management**: Comprehensive employee profiles with tabbed interface (Overview, Documents, History, Goals).
- **Department Management**: Organizational hierarchy with tree view, department heads, and employee assignments.
- **Bulk Operations**: CSV import/export with column mapping, validation preview, and error handling.
- **Enhanced Employee List**: Advanced filtering by department and status, bulk actions, and selection management.
- People directory with profile editing, growth plan, and secure document management.
- Team views for managers: check-in feed, goal reviews, and team calendar overlay.
- Workflow builder and goal-setting experiences powered by shared schemas to stay type-safe.
- Auth, session persistence, and API calls wired to Supabase with graceful fallback states.

### Backend (`apps/backend`)
- Zero-trust Supabase JWT verification, per-request user clients, and tenant-aware authorization helpers.
- Tenant lifecycle endpoints: creation, bootstrap, metadata updates, and role-based access control.
- **Enhanced Employee Management**: 20+ structured fields including personal info, employment details, compensation, and sensitive data.
- **Department CRUD**: Full organizational structure management with hierarchy support and department heads.
- **Audit Trail**: Complete change tracking with field-level history, IP logging, and user attribution.
- **CSV Import/Export**: Bulk employee operations with validation, preview, and error reporting.
- **Document Versioning**: File management with categories, expiry tracking, and version history.
- **Field-Level Security**: Role-based access control for sensitive data (salary, bank info, tax details).
- Membership and employee management including custom fields, secure storage uploads, and document downloads.
- Goal and check-in APIs that support multi-step updates, history, and manager approval queues.
- **Time & Attendance Management**: Comprehensive time tracking with clock in/out, manual entries, overtime calculation, and manager approval workflows.
- **Team Calendar & Reporting**: Manager dashboard with team calendar views, time summaries, and CSV export capabilities.
- Workflow drafting, publishing, and retrieval backed by shared validation schemas.

### Shared Library (`packages/shared`)
- Canonical Zod schemas for tenants, memberships, employees, workflows, goals, check-ins, time tracking, and example data.
- Type-safe request/response contracts exported as `@vibe/shared` for both apps.
- Validation helpers that prevent drift between frontend forms and backend enforcement.

### Supabase Workspace (`supabase`)
- SQL migrations and seeds that encode table schemas, policies, and helper RPCs.
- CLI-ready config for local Docker environments, storage buckets (for employee documents), and RLS policies.
- Example seeds that let you experience the product flows immediately after bootstrap.

## Getting Started

1. **Install prerequisites**
   - Node.js 20+
   - `pnpm` 10+
   - Bun (backend dev server) — `brew install oven-sh/bun/bun` or the official installer
   - Supabase CLI (optional but recommended) — `brew install supabase/tap/supabase`
2. **Install dependencies**
   ```bash
   pnpm install
   ```
3. **Configure your environment**
   ```bash
   cp .env.example .env.local
   ```
   Populate the Supabase values after running `supabase start` (see below). Both apps read from the root `.env.local`, and the frontend expects keys prefixed with `VITE_`.

## Running the Stack

- **Start Supabase locally**
  ```bash
  supabase start
  ```
  The CLI prints local URLs and keys; copy them into `.env.local`. When you need a clean slate, run `supabase db reset`. Stop the services anytime with `supabase stop`.

- **Run everything in watch mode**
  ```bash
  pnpm dev
  ```
  Turborepo orchestrates the frontend and backend dev servers in parallel.

- **Targeted commands**
  - Frontend: `pnpm --filter frontend dev`, `pnpm --filter frontend build`
  - Backend: `pnpm --filter backend dev`, `pnpm --filter backend start`
  - Shared package: `pnpm --filter @vibe/shared build`

- **Production builds**
  ```bash
  pnpm build
  ```
  Generates the React Router build output and prepares the backend for deployment.

## Quality Checks

- Lint: `pnpm lint` (or `pnpm --filter <workspace> lint`)
- Type safety: `pnpm typecheck`
- Tests: placeholders return success for now; add workspace-specific suites as features solidify.
- Clean artifacts: `pnpm clean` drops Turborepo caches and workspace build outputs.

## Environment Reference

- Frontend expects `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and optionally `VITE_BACKEND_URL`.
- Backend requires `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and optional `PORT`.
- `.env.local` is git-ignored; check `.env.example` for the latest keys to populate.

## Deploying to Supabase (Cloud)

You can apply the SQL in `supabase/migrations/**` to a Supabase Cloud project manually (CLI) or automatically (GitHub Actions). After deploying, point the apps at the cloud URL/keys.

### One-time setup

1. Create a project in the Supabase dashboard.
2. Note the values:
   - Project Ref (Settings → General)
   - Project URL (Settings → API)
   - anon key and service_role key (Settings → API)
   - Database password (Settings → Database)
3. Install the Supabase CLI: `brew install supabase/tap/supabase`

### Manual deploy (CLI)

Option A — link and push:

```bash
supabase login
supabase link --project-ref <YOUR_PROJECT_REF>
supabase db push --linked
```

Option B — push with a DB URL (no link):

```bash
export DB_URL="postgresql://postgres:<DB_PASSWORD>@db.<YOUR_PROJECT_REF>.supabase.co:5432/postgres"
supabase db push --db-url "$DB_URL"

# optional: seed
psql "$DB_URL" -f supabase/seed.sql
```

Point the apps at the cloud project:

- Backend (root `.env.local`):
  ```bash
  SUPABASE_URL=https://<YOUR_PROJECT_REF>.supabase.co
  SUPABASE_ANON_KEY=<ANON_KEY>
  SUPABASE_SERVICE_ROLE_KEY=<SERVICE_ROLE_KEY>
  ```
- Frontend (`apps/frontend/.env.local`):
  ```bash
  VITE_SUPABASE_URL=https://<YOUR_PROJECT_REF>.supabase.co
  VITE_SUPABASE_ANON_KEY=<ANON_KEY>
  ```

### CI deploy (GitHub Actions, monorepo with environments)

Store the workflow at `.github/workflows/supabase-migrations.yml` and use GitHub Environments (e.g., `staging`, `production`) so each environment holds its own `SUPABASE_PROJECT_REF`.

Required secrets:

- Repository secret: `SUPABASE_ACCESS_TOKEN` (Dashboard → Account → Access Tokens)
- Environment secrets (per environment): `SUPABASE_PROJECT_REF`

The workflow deploys migrations on branch changes and filters to `supabase/migrations/**`:

```yaml
name: Deploy Supabase Migrations

on:
  push:
    branches: [main, develop]
    paths:
      - supabase/migrations/**

concurrency:
  group: supabase-migrations-${{ github.ref }}
  cancel-in-progress: false

jobs:
  deploy:
    name: Deploy (${{ matrix.target.environment }})
    runs-on: ubuntu-latest
    strategy:
      matrix:
        target:
          - environment: staging
          - environment: production
    environment: ${{ matrix.target.environment }}
    if: >
      (github.ref == 'refs/heads/develop' && matrix.target.environment == 'staging') ||
      (github.ref == 'refs/heads/main' && matrix.target.environment == 'production')
    env:
      SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Install Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest

      - name: Login
        run: supabase login --token "$SUPABASE_ACCESS_TOKEN"

      - name: Link project
        run: supabase link --project-ref "$SUPABASE_PROJECT_REF"
        env:
          SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}

      - name: Push migrations
        run: supabase db push --linked
```

Notes:

- Add more environments by extending the matrix and creating matching GitHub Environments with their own `SUPABASE_PROJECT_REF`.
- Alternative: use a `SUPABASE_DB_URL` secret and run `supabase db push --db-url "$SUPABASE_DB_URL"` instead of linking.
- Never expose the `service_role` key in the frontend.

## Project Structure

```
.
├─ apps/
│  ├─ frontend/        # React Router 7 app (Tailwind 4, shadcn/ui, Supabase auth)
│  └─ backend/         # Hono API (Bun dev server, Supabase integration)
├─ packages/
│  └─ shared/          # Zod schemas, DTOs, helpers shared across the stack
├─ supabase/           # Migrations, seeds, CLI config for local Postgres & storage
├─ docs/               # Product plans, discovery notes, team rituals
├─ scripts/            # Helper scripts for cleaning, automation, CI hooks
├─ turbo.json          # Turborepo pipeline config
└─ pnpm-workspace.yaml # Workspace definitions for pnpm
```

## Core HR & Employee Management

### Employee Data Model

The enhanced employee schema includes 20+ structured fields:

**Personal Information**
- Employee Number (auto-generated)
- Date of Birth, Nationality
- Personal & Work Phone Numbers
- Emergency Contact Details
- Home Address (structured JSON)

**Employment Details**
- Job Title, Department Assignment
- Employment Type (Full-time, Part-time, Contractor, Intern)
- Work Location (Office, Remote, Hybrid)
- Start/End Dates, Employment Status
- Manager Assignment

**Compensation & Sensitive Data**
- Salary Amount, Currency, Frequency
- Encrypted Bank Account Information
- Encrypted Tax ID
- Profile Completion Percentage

**Document Management**
- File Upload with Categories (Contract, Certification, ID Document, etc.)
- Version History and Expiry Tracking
- Secure Storage Integration

### Department Management

- **Hierarchical Structure**: Multi-level department organization with parent-child relationships
- **Department Heads**: Assign employees as department leaders
- **Cost Centers**: Track departmental budgets and allocations
- **Tree View UI**: Visual representation of organizational structure

### Audit Trail & Compliance

- **Field-Level Tracking**: Every employee data change is logged with timestamp, user, and IP address
- **Change History**: Complete audit log with before/after values
- **Compliance Ready**: Meets data governance requirements for sensitive information

### Bulk Operations

- **CSV Import**: Upload employee data with column mapping and validation
- **Import Preview**: Review data before committing changes
- **Error Handling**: Detailed validation with row-level error reporting
- **CSV Export**: Export filtered employee data with customizable fields

### Permission Matrix

| Role | Employee Read | Employee Write | Compensation | Sensitive Data | Audit Log | Departments | Import/Export |
|------|---------------|----------------|--------------|----------------|-----------|-------------|---------------|
| **Owner** | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All |
| **Admin** | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All |
| **People Ops** | ✅ All | ✅ All | ✅ Read Only | ✅ Read Only | ✅ All | ✅ All | ✅ All |
| **Manager** | ✅ Team | ✅ Team | ❌ | ❌ | ✅ Team | ✅ Read Only | ❌ |
| **Employee** | ✅ Own | ✅ Own | ❌ | ❌ | ❌ | ❌ | ❌ |

### CSV Import Guide

**Required Columns**
- `name` (Full Name)
- `email` (Email Address)

**Optional Columns**
- `employee_number` (Employee Number)
- `job_title` (Job Title)
- `department_name` (Department Name)
- `manager_email` (Manager Email)
- `phone_work` (Work Phone)
- `start_date` (Start Date - YYYY-MM-DD format)
- `employment_type` (Full-time, Part-time, Contractor, Intern)
- `work_location` (Office, Remote, Hybrid)
- `status` (active, on_leave, terminated)

**Import Process**
1. Upload CSV file with employee data
2. Map CSV columns to employee fields
3. Preview data and fix validation errors
4. Confirm import to create/update employee records

## Time & Attendance Management

### Core Time Tracking Features

**Clock In/Out System**
- Real-time clock in/out with location tracking
- Break management with automatic duration calculation
- Mobile-optimized interface for remote workers
- Time entry validation and overlap prevention

**Manual Time Entry**
- Add/edit time entries for past dates
- Project and task assignment
- Notes and comments for time entries
- Manager approval workflow for manual entries

**Overtime Management**
- Configurable overtime rules (daily/weekly thresholds)
- Automatic overtime calculation and balance tracking
- Overtime multiplier settings (1.5x, 2x, etc.)
- Period-based overtime reporting

### Manager Dashboard & Calendar

**Team Calendar View**
- Day, week, and month calendar views
- Color-coded time entries and time-off requests
- Team member filtering and status indicators
- Planned vs. actual time comparison

**Time Approval Workflow**
- Pending time entry approvals dashboard
- Bulk approval actions
- Audit trail for all time entry changes
- Email notifications for approval requests

**Reporting & Export**
- CSV export with customizable date ranges
- Team time summaries and analytics
- Overtime balance reports
- Compliance reporting for labor law requirements

### Database Schema

**Core Tables**
- `time_entries`: Clock in/out records with break tracking
- `overtime_balances`: Period-based overtime hour tracking
- `overtime_rules`: Configurable overtime calculation rules
- `time_entry_audit`: Complete audit trail for compliance

**Enhanced Features**
- Row Level Security (RLS) for data protection
- Multi-tenant support with tenant isolation
- Real-time updates via Supabase subscriptions
- Comprehensive validation with Zod schemas

### API Endpoints

**Time Management**
- `POST /api/time/clock-in` - Clock in with location
- `POST /api/time/clock-out` - Clock out with break calculation
- `POST /api/time/entries` - Create manual time entry
- `GET /api/time/entries` - List time entries with filtering
- `PUT /api/time/entries/:id` - Update time entry
- `DELETE /api/time/entries/:id` - Soft delete time entry

**Approval Workflow**
- `GET /api/time/entries/pending` - Get pending approvals
- `PUT /api/time/entries/:id/approve` - Approve/reject entry
- `GET /api/time/entries/:id/audit` - Get audit trail

**Overtime Management**
- `GET /api/overtime/balance` - Get current overtime balance
- `POST /api/overtime/calculate` - Calculate overtime for period
- `GET /api/overtime/rules` - Get overtime rules

**Calendar & Reporting**
- `GET /api/calendar` - Enhanced team calendar with filtering
- `GET /api/time/export` - CSV export with filters

### Frontend Components

**Employee Interface**
- `MyTimeWidget` - Dashboard widget with clock in/out
- `ManualEntryDialog` - Manual time entry form
- `TimeEntriesTable` - Personal time entries list
- `OvertimeWidget` - Overtime balance display

**Manager Interface**
- `TeamCalendar` - Enhanced calendar with filtering
- `TimeApprovals` - Approval dashboard
- `TimeEntriesTable` - Team time management

### Permission Matrix

| Role | Clock In/Out | Manual Entry | View Own Time | View Team Time | Approve Time | Overtime Rules | Export Data |
|------|--------------|--------------|---------------|----------------|--------------|----------------|-------------|
| **Owner** | ✅ | ✅ | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All |
| **Admin** | ✅ | ✅ | ✅ All | ✅ All | ✅ All | ✅ All | ✅ All |
| **Manager** | ✅ | ✅ | ✅ Own | ✅ Team | ✅ Team | ✅ Read | ✅ Team |
| **Employee** | ✅ | ✅ | ✅ Own | ❌ | ❌ | ❌ | ❌ |

### Compliance & Security

**Audit Trail**
- Complete change tracking for all time entries
- Field-level history with before/after values
- User attribution and IP logging
- Immutable audit logs for compliance

**Data Protection**
- Row Level Security (RLS) policies
- Tenant data isolation
- Encrypted sensitive data storage
- GDPR-compliant data handling

**Labor Law Compliance**
- Configurable overtime rules per jurisdiction
- Break time tracking and enforcement
- Maximum hours per day/week validation
- Export capabilities for compliance reporting

## Next Steps

- Add real Supabase project credentials when you deploy to staging or production.
- Wire up CI to run `pnpm lint`, `pnpm typecheck`, and future test suites before merges.
- Extend `packages/shared` with any new domain areas to keep contracts synchronized.

Happy shipping! 🎯
