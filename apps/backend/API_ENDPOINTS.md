# Backend API Overview

All `/api` routes are protected by the authentication middleware configured in `src/index.ts`. Paths that include `:parameter` segments expect the corresponding value in the URL.

## Base and Authentication
| Method | Path | Description |
| --- | --- | --- |
| GET | `/` | Basic health/ping endpoint that returns `Hello Hono!`. |
| GET | `/api/me` | Returns the authenticated user's id, email, display name, tenant id, and role metadata. |

## Analytics
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/example/chart` | Supplies mock chart data for dashboard prototyping. |
| GET | `/api/example/table` | Supplies mock tabular data for dashboard prototyping. |

## Tenants
| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/tenants` | Creates a new tenant via the `app_create_tenant` RPC. |
| POST | `/api/account/bootstrap` | Bootstraps the account for the signed-in user, ensuring a tenant, profile, and initial setup metadata exist. |
| PUT | `/api/onboarding/step` | Saves onboarding wizard data for the current tenant and finalizes setup on step 3. |
| GET | `/api/tenants/me` | Returns tenant details for the current user's primary membership. |
| GET | `/api/permissions/:tenantId` | Checks whether the user has a specific permission in the tenant (requires `?permission=...`). |
| PUT | `/api/tenants/:id` | Updates tenant profile information (name, contact details, etc.). |

## Feature Flags
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/features` | Returns the current tenant's resolved feature flags (default + override metadata). |
| GET | `/api/admin/features` | Superadmin endpoint that lists every tenant with their effective feature flags. |
| PUT | `/api/admin/features/:tenantId/:featureSlug` | Creates/removes a tenant override for the given feature slug (superadmin only). |

## Memberships
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/memberships/:tenantId` | Lists members of the tenant along with their roles and email addresses. |
| POST | `/api/memberships/:tenantId` | Adds a user to the tenant with the provided role (enforces owner-role guardrails). |
| PUT | `/api/memberships/:tenantId/:userId` | Updates a member's role, preserving owner-only restrictions. |
| DELETE | `/api/memberships/:tenantId/:userId` | Removes a member from the tenant. |

## Access Management
| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/access/grant` | Grants a system access record to an employee after permission checks. |
| PUT | `/api/access/revoke` | Marks an access grant as revoked and records the acting user. |
| GET | `/api/access/:employeeId` | Lists access grants for an employee (requires `tenantId` query parameter). |

## Equipment
| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/equipment/assign` | Assigns equipment to an employee and records device metadata. |
| GET | `/api/equipment/:employeeId` | Lists equipment assigned to an employee for a given tenant. |
| PUT | `/api/equipment/:id/return` | Marks equipment as returned and clears the employee association. |

## Cross-Functional Approvals
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/approvals/requests` | Lists approval requests (equipment, training, salary changes) with optional `category` and `status` filters. |
| POST | `/api/approvals/requests` | Submits a new approval request for the current tenant after permission checks. |
| PUT | `/api/approvals/requests/:id/decision` | Approves or denies an approval request and tracks the decision reason. |

## Employees

### Employee Profiles
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/employees/:tenantId` | Paged employee list with filtering, sorting, and permission checks. |
| POST | `/api/employees/:tenantId` | Creates a new employee record and triggers onboarding workflows if configured. |
| GET | `/api/employees/:tenantId/:id` | Returns detailed employee information, permissions, documents, and related metadata. |
| PUT | `/api/employees/:tenantId/:id` | Updates employee fields (role, department, compensation, etc.) with auditing. |
| DELETE | `/api/employees/:tenantId/:id` | Marks an employee as inactive and logs termination details. |

### Employee Documents
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/employees/:tenantId/:id/documents` | Lists documents for an employee (requires document read permission). |
| POST | `/api/employees/:tenantId/:id/documents` | Uploads a document, stores it in Supabase Storage, and versions older files. |
| GET | `/api/employees/:tenantId/:id/documents/:docId/download` | Generates a signed download URL for a stored document. |
| DELETE | `/api/employees/:tenantId/:id/documents/:docId` | Deletes or versions out a document and records the audit trail. |

### Departments
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/departments/:tenantId` | Lists departments for the tenant. |
| GET | `/api/departments/:tenantId/tree` | Returns the department hierarchy for tree views. |
| GET | `/api/departments/:tenantId/:id` | Fetches department details. |
| POST | `/api/departments/:tenantId` | Creates a department. |
| PUT | `/api/departments/:tenantId/:id` | Updates department metadata. |
| DELETE | `/api/departments/:tenantId/:id` | Deletes a department (after dependency checks). |

### Office Locations
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/office-locations/:tenantId` | Lists office locations for a tenant. |
| GET | `/api/office-locations/:tenantId/:id` | Returns office location details. |
| POST | `/api/office-locations/:tenantId` | Creates an office location. |
| PUT | `/api/office-locations/:tenantId/:id` | Updates office location information. |
| DELETE | `/api/office-locations/:tenantId/:id` | Removes an office location if unused. |

### Teams
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/teams/:tenantId` | Lists teams for the tenant. |
| GET | `/api/teams/:tenantId/:id` | Returns team details including membership. |
| POST | `/api/teams/:tenantId` | Creates a team. |
| PUT | `/api/teams/:tenantId/:id` | Updates team metadata. |
| DELETE | `/api/teams/:tenantId/:id` | Deletes a team. |
| POST | `/api/teams/:tenantId/:id/members` | Adds members to a team. |
| DELETE | `/api/teams/:tenantId/:id/members/:employeeId` | Removes a member from a team. |

### Audit Logs
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/employees/:tenantId/:employeeId/audit-log` | Returns the recent audit trail for an employee. |
| GET | `/api/employees/:tenantId/:employeeId/audit-log/compare/:logId` | Compares a specific audit entry against the current employee record. |

## Imports and Exports
| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/employees/:tenantId/import/preview` | Validates a CSV import file and reports valid/invalid rows. |
| POST | `/api/employees/:tenantId/import/confirm` | Applies a validated import, creating or updating employee records with auditing. |
| GET | `/api/employees/:tenantId/export` | Exports employee data to CSV (optional filters and sensitive-fields toggle). |

## Onboarding
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/journeys/:shareToken` | Public share-token endpoint showing an employee's onboarding journey summary. |
| POST | `/api/onboarding/start` | Starts onboarding workflows for an employee (manual workflow or automatic trigger). |
| GET | `/api/onboarding/instances/:employeeId` | Lists onboarding workflow runs for an employee (requires tenant query parameter). |
| GET | `/api/onboarding/tasks/:employeeId` | Returns outstanding onboarding tasks for the employee. |
| PUT | `/api/onboarding/tasks/:id/complete` | Marks a workflow task as completed and advances the run. |

## Offboarding
| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/offboarding/initiate` | Schedules offboarding for an employee and triggers the corresponding workflow. |
| GET | `/api/offboarding/checklist/:employeeId` | Returns workflow tasks, equipment, and access that must be closed for offboarding. |
| POST | `/api/exit-interview/submit` | Records an exit interview, allowing self-service submissions when applicable. |

## Workflows
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/workflows/:tenantId` | Lists workflow drafts and published definitions for a tenant. |
| POST | `/api/workflows/:tenantId` | Creates a workflow draft from designer input. |
| GET | `/api/workflows/:tenantId/:workflowId` | Returns detailed workflow configuration. |
| PUT | `/api/workflows/:tenantId/:workflowId` | Updates a workflow draft. |
| POST | `/api/workflows/:tenantId/:workflowId/publish` | Publishes the active workflow version. |

## Performance

### Team Overview
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/my-team` | Returns the manager's team roster with goal stats and last check-in information. |

### Goals
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/goals/me` | Lists personal goals for the signed-in employee. |
| GET | `/api/my-team/:employeeId/goals` | Returns goals for a direct report (permission-gated). |
| POST | `/api/goals` | Creates a goal with key results for an employee. |
| PATCH | `/api/goals/:goalId` | Updates goal metadata, status, or progress. |
| DELETE | `/api/goals/:goalId` | Archives a goal and stops further tracking. |

### Check-ins
| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/check-ins` | Creates a check-in for an employee with agenda items. |
| PATCH | `/api/check-ins/:checkInId` | Updates a check-in (notes, status, completion). |
| GET | `/api/check-ins/:employeeId` | Lists check-ins for a given employee. |
| GET | `/api/check-in/:checkInId` | Returns detailed information for a specific check-in. |
| GET | `/api/check-ins/me` | Lists check-ins assigned to the current user. |

## Time Management

### Time Summary and Clocking
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/time/summary` | Aggregated time summary for the signed-in user. |
| POST | `/api/time/clock-in` | Starts a real-time time entry for the user (prevents multiple active entries). |
| POST | `/api/time/clock-out` | Closes the active time entry for the user and records duration. |

### Time Entries
| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/time/entries` | Creates a manual time entry (with overlap checks and approval routing). |
| GET | `/api/time/entries` | Lists time entries with filtering options for managers. |
| PUT | `/api/time/entries/:id` | Updates an existing time entry (adjust start/end, notes, status). |
| DELETE | `/api/time/entries/:id` | Deletes a time entry. |
| GET | `/api/time/entries/pending` | Returns time entries awaiting approval for the manager. |
| PUT | `/api/time/entries/:id/approve` | Approves or rejects a pending time entry. |
| GET | `/api/time/entries/:id/audit` | Returns the audit log for a time entry. |
| GET | `/api/time/export` | Exports time entries for a date range in CSV format. |

### Time-Off Requests
| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/time-off/requests` | Submits a time-off request for the signed-in user. |
| PUT | `/api/time-off/requests/:id/approve` | Approves or denies a time-off request. |
| GET | `/api/time-off/requests/pending` | Lists pending time-off requests that require action. |

### Calendar
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/calendar` | Manager-facing calendar of team time-off, overtime, and optional breaks with export support. |
| GET | `/api/leave/team-calendar` | Returns leave requests and holidays for team calendar views. |

### Overtime
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/overtime/balance` | Returns the current user's overtime balance summary. |
| GET | `/api/overtime/balance/:userId` | Returns overtime balance for a specific employee (manager access). |
| POST | `/api/overtime/calculate` | Calculates overtime for a requested period. |
| GET | `/api/overtime/rules` | Lists defined overtime rules for the tenant. |
| POST | `/api/overtime/request` | Submits an overtime compensation request. |
| GET | `/api/overtime/requests` | Lists overtime requests with filtering for status and assignee. |
| PUT | `/api/overtime/requests/:id/approve` | Approves or denies an overtime request. |

### Employee Leave Fields
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/employee-fields/:tenantId` | Lists custom employee leave fields for a tenant. |
| POST | `/api/employee-fields/:tenantId` | Creates a custom employee leave field. |
| PUT | `/api/employee-fields/:tenantId/:id` | Updates a custom leave field definition. |
| DELETE | `/api/employee-fields/:tenantId/:id` | Removes a custom leave field definition. |

### Leave Types
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/leave/types` | Lists leave types configured for the tenant. |
| POST | `/api/leave/types` | Creates a leave type. |
| PUT | `/api/leave/types/:id` | Updates leave type metadata. |
| DELETE | `/api/leave/types/:id` | Deletes a leave type (if unused). |

### Leave Balances
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/leave/balances/my-balance` | Returns the signed-in user's leave balances across leave types. |
| GET | `/api/leave/balances/:employeeId` | Returns leave balances for a specific employee. |
| POST | `/api/leave/balances/:employeeId/adjust` | Adjusts an employee's leave balances (positive or negative). |
| GET | `/api/leave/balances/team` | Manager rollup of team leave balances and usage. |

### Holidays
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/leave/holidays` | Lists holiday calendar entries. |
| POST | `/api/leave/holidays` | Creates a holiday entry. |
| POST | `/api/leave/holidays/bulk` | Bulk-imports holiday calendar entries. |
| DELETE | `/api/leave/holidays/:id` | Removes a holiday entry. |

### Blackout Periods
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/leave/blackout-periods` | Lists blackout periods where leave cannot be booked. |
| POST | `/api/leave/blackout-periods` | Creates a blackout period. |
| PUT | `/api/leave/blackout-periods/:id` | Updates blackout period dates or notes. |
| DELETE | `/api/leave/blackout-periods/:id` | Deletes a blackout period. |

### Leave Requests
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/leave/requests` | Lists leave requests with rich filtering for managers. |
| POST | `/api/leave/requests` | Submits a leave request (enhanced schema compared to legacy time-off). |
| PUT | `/api/leave/requests/:id` | Updates a leave request (dates, type, notes). |
| DELETE | `/api/leave/requests/:id` | Cancels or deletes a leave request. |
| PUT | `/api/leave/requests/:id/approve` | Approves or denies a leave request with optional notes. |
| GET | `/api/leave/requests/:id/audit` | Returns audit trail entries for a leave request. |

## Leave Analytics
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/leave/analytics/utilization` | Utilization analytics aggregated by employee, department, or leave type. |
| GET | `/api/leave/analytics/trends` | Historical leave trends with monthly, quarterly, or annual aggregation. |
| GET | `/api/leave/analytics/summary` | Summary KPIs for leave usage (totals, averages, pending counts). |
| GET | `/api/leave/analytics/export` | CSV export of utilization or trend analytics. |

## Recruiting

### Jobs
| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/jobs` | Creates a new job posting in draft status. |
| GET | `/api/jobs` | Lists jobs for a tenant with filtering, search, and pagination. |
| GET | `/api/jobs/:tenantId/:id` | Returns job details, postings, and application stats. |
| PUT | `/api/jobs/:tenantId/:id` | Updates job information (title, description, compensation, status). |
| POST | `/api/jobs/:tenantId/:id/publish` | Publishes a job and creates postings for selected channels. |

### Candidates
| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/candidates` | Creates or updates a candidate and ensures an application exists. |
| GET | `/api/candidates` | Lists candidates with application context and filtering by job or status. |
| GET | `/api/candidates/:tenantId/:id` | Returns candidate details and associated applications. |

### Applications
| Method | Path | Description |
| --- | --- | --- |
| PUT | `/api/applications/:tenantId/:id/stage` | Moves an application to a new pipeline stage and logs the transition. |

### Interviews
| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/interviews` | Schedules an interview for an application (with participants and logistics). |
| GET | `/api/interviews` | Lists interviews with filtering by job, candidate, or date. |
| POST | `/api/interviews/:id/evaluate` | Records interviewer feedback for a completed interview. |

### Communications
| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/communications/email` | Sends an email communication to a candidate and logs it. |
| GET | `/api/communications` | Lists candidate communications across channels. |

### Recruiting Analytics
| Method | Path | Description |
| --- | --- | --- |
| GET | `/api/recruiting/analytics/funnel` | Returns funnel analytics for recruiting stages. |
| GET | `/api/recruiting/analytics/sources` | Summarizes candidate sources and conversion metrics. |
