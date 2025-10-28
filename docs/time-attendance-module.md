# Time & Attendance Module Documentation

## Overview

The Time & Attendance module is a comprehensive workforce management solution that provides real-time time tracking, overtime management, manager dashboards, and compliance reporting. Built on top of the Artemis monorepo architecture, it integrates seamlessly with the existing HR and employee management systems.

## Architecture

### Database Schema

The module extends the existing database with four new tables and enhanced functionality:

#### Core Tables

**`time_entries` (Enhanced)**
```sql
-- Extended with new columns
ALTER TABLE public.time_entries
ADD COLUMN break_minutes INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN project_task TEXT,
ADD COLUMN notes TEXT,
ADD COLUMN entry_type TEXT DEFAULT 'clock' NOT NULL CHECK (entry_type IN ('clock', 'manual')),
ADD COLUMN approval_status TEXT DEFAULT 'approved' NOT NULL CHECK (approval_status IN ('approved', 'pending', 'rejected')),
ADD COLUMN approver_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN approved_at TIMESTAMPTZ,
ADD COLUMN edited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now() NOT NULL;
```

**`overtime_balances`**
```sql
CREATE TABLE public.overtime_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period TEXT NOT NULL, -- e.g., '2025-W10'
  regular_hours NUMERIC(8,2) DEFAULT 0.00 NOT NULL,
  overtime_hours NUMERIC(8,2) DEFAULT 0.00 NOT NULL,
  overtime_multiplier NUMERIC(3,2) DEFAULT 1.50 NOT NULL,
  carry_over_hours NUMERIC(8,2) DEFAULT 0.00 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (tenant_id, user_id, period)
);
```

**`overtime_rules`**
```sql
CREATE TABLE public.overtime_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  daily_threshold NUMERIC(4,2) DEFAULT 8.00 NOT NULL,
  weekly_threshold NUMERIC(5,2) DEFAULT 40.00 NOT NULL,
  daily_multiplier NUMERIC(3,2) DEFAULT 1.50 NOT NULL,
  weekly_multiplier NUMERIC(3,2) DEFAULT 1.50 NOT NULL,
  is_default BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (tenant_id, name)
);
```

**`time_entry_audit`**
```sql
CREATE TABLE public.time_entry_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id UUID NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  field_name TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  change_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);
```

#### Views

**`pending_time_approvals`**
```sql
CREATE OR REPLACE VIEW public.pending_time_approvals AS
SELECT
  tes.id,
  tes.tenant_id,
  tes.user_id,
  e.name AS employee_name,
  e.email AS employee_email,
  e.employee_number,
  tes.clock_in_at,
  tes.clock_out_at,
  tes.duration_minutes,
  tes.break_minutes,
  tes.project_task,
  tes.notes,
  tes.entry_type,
  tes.created_at,
  m.user_id AS manager_id,
  m.name AS manager_name
FROM public.time_entries tes
JOIN public.employees e ON tes.user_id = e.user_id
LEFT JOIN public.employees m ON e.manager_id = m.id
WHERE tes.approval_status = 'pending'
ORDER BY tes.created_at DESC;
```

### Row Level Security (RLS)

The module implements comprehensive RLS policies to ensure data security:

- **Users**: Can view/edit their own time entries
- **Managers**: Can view/edit team member time entries
- **Admins**: Full access to all time data
- **Audit Logs**: Restricted access based on user role and data ownership

## API Endpoints

### Time Management

#### Clock In/Out
- `POST /api/time/clock-in` - Clock in with optional location
- `POST /api/time/clock-out` - Clock out with break calculation

#### Manual Time Entry
- `POST /api/time/entries` - Create manual time entry
- `GET /api/time/entries` - List time entries with filtering
- `PUT /api/time/entries/:id` - Update time entry
- `DELETE /api/time/entries/:id` - Soft delete time entry

#### Time Summary
- `GET /api/time/summary` - Get current user's time summary

### Approval Workflow

- `GET /api/time/entries/pending` - Get pending approvals for managers
- `PUT /api/time/entries/:id/approve` - Approve/reject time entry
- `GET /api/time/entries/:id/audit` - Get audit trail for time entry

### Overtime Management

- `GET /api/overtime/balance` - Get current user's overtime balance
- `GET /api/overtime/balance/:userId` - Get team member's overtime balance
- `POST /api/overtime/calculate` - Calculate overtime for period
- `GET /api/overtime/rules` - Get overtime rules configuration

### Calendar & Reporting

- `GET /api/calendar` - Enhanced team calendar with filtering
- `GET /api/time/export` - CSV export with customizable filters

## Frontend Components

### Employee Interface

#### MyTimeWidget
```typescript
// Dashboard widget with clock in/out functionality
interface MyTimeWidgetProps {
  onTimeEntrySuccess?: () => void;
}
```

**Features:**
- Current time status display
- Clock in/out button with real-time updates
- Weekly hours summary
- PTO balance display
- Manual entry button
- Overtime balance widget

#### ManualEntryDialog
```typescript
// Modal for manual time entry
interface ManualEntryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}
```

**Features:**
- Date and time pickers
- Project/task assignment
- Notes field
- Break time input
- Validation and error handling

#### TimeEntriesTable
```typescript
// Table component for displaying time entries
interface TimeEntriesTableProps {
  entries: TimeEntry[];
  onEdit?: (entry: TimeEntry) => void;
  onDelete?: (entry: TimeEntry) => void;
  showActions?: boolean;
}
```

**Features:**
- Sortable columns
- Filtering and search
- Edit/delete actions
- Status indicators
- Responsive design

#### OvertimeWidget
```typescript
// Widget for displaying overtime information
interface OvertimeWidgetProps {
  userId?: string; // Optional for team member view
}
```

**Features:**
- Current period overtime hours
- Overtime multiplier display
- Carry-over hours
- Link to detailed overtime page

### Manager Interface

#### TeamCalendar (Enhanced)
```typescript
// Enhanced calendar with filtering and export
interface TeamCalendarProps {
  // Existing props plus new filtering options
}
```

**New Features:**
- Status filtering (all, worked, time-off, pending)
- Team member filtering
- Break time inclusion toggle
- CSV export functionality
- Color-coded events
- Legend for event types

#### TimeApprovals
```typescript
// Manager approval dashboard
interface TimeApprovalsProps {
  // Props for approval management
}
```

**Features:**
- Pending approvals list
- Bulk approval actions
- Individual approval/rejection
- Employee information display
- Audit trail access

## Business Logic

### Overtime Calculation

The system automatically calculates overtime based on configurable rules:

```typescript
interface OvertimeRule {
  daily_threshold: number;    // e.g., 8.00 hours
  weekly_threshold: number;   // e.g., 40.00 hours
  daily_multiplier: number;   // e.g., 1.50x
  weekly_multiplier: number;  // e.g., 1.50x
}
```

**Calculation Logic:**
1. Calculate total hours worked per day
2. Apply daily overtime for hours > daily_threshold
3. Calculate total hours worked per week
4. Apply weekly overtime for hours > weekly_threshold
5. Update overtime_balances table with calculated values

### Approval Workflow

**Automatic Approval:**
- Clock in/out entries are automatically approved
- Manual entries for current day are automatically approved

**Manual Approval Required:**
- Manual entries for past dates
- Entries with significant changes
- Entries exceeding normal working hours

### Overlap Prevention

The system prevents overlapping time entries:

```typescript
async function checkTimeEntryOverlap(
  userId: string,
  startTime: Date,
  endTime: Date,
  excludeId?: string
): Promise<boolean> {
  // Check for existing entries that overlap with the given time range
  // Returns true if overlap is found
}
```

### Audit Trail

Every change to time entries is logged:

```typescript
interface TimeEntryAudit {
  time_entry_id: string;
  changed_by: string;
  field_name: string;
  old_value: any;
  new_value: any;
  change_reason?: string;
  created_at: Date;
}
```

## Data Validation

### Zod Schemas

The module uses comprehensive Zod schemas for type safety:

```typescript
// Time entry schemas
export const TimeEntrySchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  user_id: z.string().uuid(),
  clock_in_at: z.string().datetime(),
  clock_out_at: z.string().datetime().nullable(),
  duration_minutes: z.number().int().min(0),
  break_minutes: z.number().int().min(0).default(0),
  project_task: z.string().optional(),
  notes: z.string().optional(),
  entry_type: z.enum(['clock', 'manual']).default('clock'),
  approval_status: z.enum(['approved', 'pending', 'rejected']).default('approved'),
  approver_user_id: z.string().uuid().nullable(),
  approved_at: z.string().datetime().nullable(),
  edited_by: z.string().uuid().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

// Manual entry input schema
export const ManualTimeEntryInputSchema = z.object({
  date: z.string().date(),
  clock_in_time: z.string().regex(/^\d{2}:\d{2}$/),
  clock_out_time: z.string().regex(/^\d{2}:\d{2}$/),
  break_minutes: z.number().int().min(0).default(0),
  project_task: z.string().optional(),
  notes: z.string().optional(),
});
```

## Security & Compliance

### Row Level Security (RLS)

All tables implement RLS policies:

```sql
-- Users can view their own time entries
CREATE POLICY "Users can view their own time entries." 
ON public.time_entries FOR SELECT 
USING (auth.uid() = user_id);

-- Managers can view team time entries
CREATE POLICY "Managers can view team time entries" 
ON public.time_entries FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.memberships 
    WHERE user_id = auth.uid() 
    AND tenant_id = public.time_entries.tenant_id 
    AND (role = 'admin' OR role = 'manager')
  )
  AND EXISTS (
    SELECT 1 FROM public.employees e 
    JOIN public.employees m ON e.manager_id = m.id 
    WHERE e.user_id = public.time_entries.user_id 
    AND m.user_id = auth.uid()
  )
);
```

### Data Encryption

Sensitive data is encrypted at rest:
- Personal information in employee records
- Audit trail data
- Configuration settings

### GDPR Compliance

- Right to be forgotten (data deletion)
- Data portability (CSV export)
- Audit trail for data access
- Consent management

## Performance Considerations

### Database Indexing

```sql
-- Indexes for performance
CREATE INDEX idx_time_entries_user_date ON public.time_entries(user_id, clock_in_at);
CREATE INDEX idx_time_entries_tenant_status ON public.time_entries(tenant_id, approval_status);
CREATE INDEX idx_overtime_balances_user_period ON public.overtime_balances(user_id, period);
CREATE INDEX idx_time_entry_audit_time_entry ON public.time_entry_audit(time_entry_id);
```

### Caching Strategy

- Time summaries cached for 5 minutes
- Overtime balances cached per period
- Calendar data cached with invalidation on updates

### Real-time Updates

- WebSocket connections for live updates
- Supabase realtime subscriptions
- Optimistic UI updates

## Testing Strategy

### Unit Tests

- API endpoint testing
- Business logic validation
- Schema validation
- Helper function testing

### Integration Tests

- Database operations
- RLS policy testing
- End-to-end workflows
- Error handling

### Performance Tests

- Load testing for calendar views
- Database query optimization
- Memory usage monitoring

## Deployment

### Database Migrations

```bash
# Apply migrations
supabase db push

# Generate types
supabase gen types typescript --local > packages/shared/src/database.types.ts
```

### Environment Variables

```bash
# Backend
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Frontend
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
VITE_BACKEND_URL=your_backend_url
```

## Monitoring & Analytics

### Key Metrics

- Clock in/out frequency
- Overtime hours per employee
- Approval processing time
- System performance metrics

### Alerts

- Failed clock in/out attempts
- Pending approvals backlog
- System errors
- Performance degradation

## Future Enhancements

### Phase 2 Features

- Biometric device integration
- Mobile app development
- Advanced reporting dashboards
- Integration with payroll systems
- Project management tool integration
- Advanced compliance reporting

### Scalability

- Horizontal scaling for high-volume tenants
- Database partitioning strategies
- CDN integration for global access
- Microservices architecture consideration

## Troubleshooting

### Common Issues

1. **Clock in/out failures**
   - Check user permissions
   - Verify tenant configuration
   - Review RLS policies

2. **Overtime calculation errors**
   - Verify overtime rules configuration
   - Check time entry data integrity
   - Review calculation logic

3. **Approval workflow issues**
   - Check manager assignments
   - Verify approval permissions
   - Review audit trail

### Debug Tools

- Database query logging
- API request/response logging
- Frontend error tracking
- Performance monitoring

## Support

For technical support or feature requests, please refer to the main Artemis documentation or contact the development team.

---

*Last updated: February 2025*
*Version: 1.0.0*
