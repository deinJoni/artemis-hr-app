<!-- 019f1991-3a4e-44a7-a78a-ac0e6381fb2b 6cdb7203-658f-463d-a743-ca7a759ca624 -->
# Comprehensive Browser Testing Plan for Artemis HR Application

## Testing Overview

This plan provides detailed test cases for all implemented functions in the Artemis HR application. Each test case includes:

- **Test Objective**: What is being tested
- **Prerequisites**: Required setup/data
- **Test Steps**: Step-by-step browser actions
- **Expected Results**: What should happen
- **Test Data**: Sample data to use

## Test Environment Setup

- **Frontend URL**: http://localhost:5173
- **Backend URL**: http://localhost:8787
- **Database**: Fresh Supabase instance (reset before testing)
- **Browser**: Chrome/Firefox/Safari (test in multiple browsers)
- **Test Users**: Create users with different roles (Owner, Admin, Manager, Employee)

---

## Module 1: Authentication & User Management

### 1.1 User Registration

**Test Case**: TC-AUTH-001

- **Objective**: Verify new user can register successfully
- **Prerequisites**: None
- **Steps**:

1. Navigate to `/register`
2. Enter email: `testuser@example.com`
3. Enter password: `TestPassword123!`
4. Confirm password: `TestPassword123!`
5. Click "Register"

- **Expected**: User created, redirected to onboarding, success message displayed
- **Negative Cases**:
- TC-AUTH-001-N1: Invalid email format → Error message
- TC-AUTH-001-N2: Weak password → Validation error
- TC-AUTH-001-N3: Password mismatch → Error message
- TC-AUTH-001-N4: Existing email → Error message

### 1.2 User Login

**Test Case**: TC-AUTH-002

- **Objective**: Verify user can log in with valid credentials
- **Prerequisites**: Registered user exists
- **Steps**:

1. Navigate to `/login`
2. Enter email: `testuser@example.com`
3. Enter password: `TestPassword123!`
4. Click "Sign In"

- **Expected**: Redirected to dashboard, session established
- **Negative Cases**:
- TC-AUTH-002-N1: Wrong password → Error message
- TC-AUTH-002-N2: Non-existent email → Redirect to register
- TC-AUTH-002-N3: Empty fields → Validation errors

### 1.3 Password Reset

**Test Case**: TC-AUTH-003

- **Objective**: Verify password reset flow
- **Prerequisites**: Registered user exists
- **Steps**:

1. Navigate to `/reset-password`
2. Enter email: `testuser@example.com`
3. Click "Send Reset Link"

- **Expected**: Success message, email sent (check email if configured)
- **Negative Cases**:
- TC-AUTH-003-N1: Invalid email → Error message
- TC-AUTH-003-N2: Non-existent email → Generic success (security)

### 1.4 Session Management

**Test Case**: TC-AUTH-004

- **Objective**: Verify session persistence and logout
- **Prerequisites**: User logged in
- **Steps**:

1. Login successfully
2. Refresh page
3. Navigate to different pages
4. Click logout
5. Try accessing protected route

- **Expected**: Session persists across refreshes, logout clears session, protected routes redirect to login

---

## Module 2: Onboarding Flow

### 2.1 Three-Step Onboarding - Step 1: Company Basics

**Test Case**: TC-ONBOARD-001

- **Objective**: Verify company information collection
- **Prerequisites**: New user registered
- **Steps**:

1. Complete registration
2. On onboarding Step 1, enter:

- Company Name: `Test Company Inc.`
- Industry: Select from dropdown
- Company Size: Select from dropdown

3. Click "Next"

- **Expected**: Proceeds to Step 2, data saved
- **Negative Cases**:
- TC-ONBOARD-001-N1: Empty company name → Validation error
- TC-ONBOARD-001-N2: Missing required fields → Cannot proceed

### 2.2 Three-Step Onboarding - Step 2: Contact Details

**Test Case**: TC-ONBOARD-002

- **Objective**: Verify contact information collection
- **Prerequisites**: Step 1 completed
- **Steps**:

1. On Step 2, enter:

- Phone: `+1-555-0123`
- Address: `123 Main St, City, State, ZIP`
- Website: `https://example.com` (optional)

2. Click "Next"

- **Expected**: Proceeds to Step 3, data saved
- **Negative Cases**:
- TC-ONBOARD-002-N1: Invalid phone format → Validation error
- TC-ONBOARD-002-N2: Invalid URL format → Validation error

### 2.3 Three-Step Onboarding - Step 3: Goals

**Test Case**: TC-ONBOARD-003

- **Objective**: Verify goals setup and tenant finalization
- **Prerequisites**: Steps 1-2 completed
- **Steps**:

1. On Step 3, enter:

- Primary Goal: Select from options
- Additional goals: Select multiple

2. Click "Complete Setup"

- **Expected**: 
- Tenant created successfully
- Leave balances created automatically
- Redirected to dashboard
- No duplicate balance errors
- **Negative Cases**:
- TC-ONBOARD-003-N1: Missing primary goal → Validation error
- TC-ONBOARD-003-N2: Duplicate balance creation → Handled gracefully (already fixed)

### 2.4 Onboarding Data Persistence

**Test Case**: TC-ONBOARD-004

- **Objective**: Verify onboarding data persists across steps
- **Prerequisites**: Started onboarding
- **Steps**:

1. Complete Step 1
2. Refresh page
3. Verify Step 2 shows with Step 1 data saved
4. Complete Step 2
5. Refresh page
6. Verify Step 3 shows with Steps 1-2 data saved

- **Expected**: All previous step data persists, user can continue from last step

---

## Module 3: Dashboard

### 3.1 Dashboard Load

**Test Case**: TC-DASH-001

- **Objective**: Verify dashboard loads with all widgets
- **Prerequisites**: User logged in, onboarding completed
- **Steps**:

1. Navigate to `/` (dashboard)
2. Wait for page load
3. Verify all widgets display

- **Expected**: 
- Dashboard loads without errors
- All widgets visible: Workspace Health, My Time, Notifications, Quick Actions
- No 401/403 errors
- Loading states show during data fetch
- **Negative Cases**:
- TC-DASH-001-N1: No tenant data → Graceful empty state
- TC-DASH-001-N2: API error → Error message displayed

### 3.2 Dashboard Widgets - My Time Widget

**Test Case**: TC-DASH-002

- **Objective**: Verify My Time widget displays time data
- **Prerequisites**: User has time entries
- **Steps**:

1. View dashboard
2. Check My Time widget
3. Verify clock in/out button
4. Click clock in/out

- **Expected**: 
- Widget shows current time status
- Clock in/out button functional
- Time summary displayed correctly

### 3.3 Dashboard Widgets - Leave Balance Widget

**Test Case**: TC-DASH-003

- **Objective**: Verify leave balance widget displays correctly
- **Prerequisites**: User has leave balances
- **Steps**:

1. View dashboard
2. Check Leave Balance widget
3. Verify all leave types shown
4. Verify balance amounts correct

- **Expected**: 
- All leave types displayed
- Balances match database
- Progress bars render correctly

### 3.4 Quick Actions Menu (Cmd+K)

**Test Case**: TC-DASH-004

- **Objective**: Verify quick actions menu functionality
- **Prerequisites**: User logged in
- **Steps**:

1. Press `Cmd+K` (or `Ctrl+K` on Windows)
2. Verify menu opens
3. Type to search actions
4. Select an action
5. Verify action executes

- **Expected**: 
- Menu opens on keyboard shortcut
- Search filters actions correctly
- Actions execute (navigate, open dialogs, etc.)
- **Test Actions**:
- Clock In/Out
- Request Time Off
- Add Time Entry
- Add Employee
- View Time Entries
- View Leave Requests

### 3.5 Theme Switching

**Test Case**: TC-DASH-005

- **Objective**: Verify theme toggle works
- **Prerequisites**: User logged in
- **Steps**:

1. Click theme toggle in header
2. Verify theme changes (light/dark)
3. Refresh page
4. Verify theme persists

- **Expected**: 
- Theme switches immediately
- Theme preference saved
- Persists across page refreshes

### 3.6 Dashboard Quick Links

**Test Case**: TC-DASH-006

- **Objective**: Verify quick links navigate correctly
- **Prerequisites**: User logged in
- **Steps**:

1. View dashboard
2. Click each quick link
3. Verify navigation works

- **Expected**: All links navigate to correct routes without errors

---

## Module 4: Employee Management

### 4.1 Employee List View

**Test Case**: TC-EMP-001

- **Objective**: Verify employee list displays correctly
- **Prerequisites**: Employees exist in system
- **Steps**:

1. Navigate to `/employees`
2. Verify table loads
3. Check pagination
4. Test search functionality

- **Expected**: 
- Table displays all employees
- Pagination works
- Search filters results
- Columns display correctly
- **Negative Cases**:
- TC-EMP-001-N1: No employees → Empty state displayed
- TC-EMP-001-N2: API error → Error message

### 4.2 Employee Filters

**Test Case**: TC-EMP-002

- **Objective**: Verify employee filtering works
- **Prerequisites**: Multiple employees with different attributes
- **Steps**:

1. Navigate to `/employees`
2. Open filters panel
3. Filter by Department: Select a department
4. Filter by Status: Select "Active"
5. Filter by Office Location: Select a location
6. Verify filtered results
7. Clear filters

- **Expected**: 
- Filters apply correctly
- Filter badge shows count
- Results update immediately
- Clear button resets filters
- **Test Filters**:
- Department filter
- Status filter (Active, On Leave, Terminated, Inactive)
- Office Location filter
- Combined filters

### 4.3 Employee Creation Wizard - Step 1: Personal Information

**Test Case**: TC-EMP-003

- **Objective**: Verify employee creation Step 1
- **Prerequisites**: User with create permission
- **Steps**:

1. Navigate to `/employees`
2. Click "Add Employee"
3. On Step 1, enter:

- Full Name: `John Doe`
- Email: `john.doe@example.com`
- Date of Birth: `1990-01-15`
- Phone: `+1-555-0100`
- Nationality: Select from dropdown

4. Click "Next"

- **Expected**: Proceeds to Step 2, data saved
- **Negative Cases**:
- TC-EMP-003-N1: Invalid email → Validation error
- TC-EMP-003-N2: Missing required fields → Cannot proceed
- TC-EMP-003-N3: Duplicate email → Error message

### 4.4 Employee Creation Wizard - Step 2: Employment Details

**Test Case**: TC-EMP-004

- **Objective**: Verify employee creation Step 2 with field persistence
- **Prerequisites**: Step 1 completed
- **Steps**:

1. On Step 2, enter:

- Job Title: `Software Engineer`
- Department: Select from dropdown
- Employment Type: Select "Full-time"
- Start Date: `2025-01-01`
- Work Location: Select "Remote"

2. Click "Next"
3. Refresh page (test persistence)
4. Verify Step 2 data still present

- **Expected**: 
- Proceeds to Step 3
- All Step 2 fields persist on refresh
- Data saved correctly
- **Negative Cases**:
- TC-EMP-004-N1: Missing job title → Validation error
- TC-EMP-004-N2: Invalid date → Validation error

### 4.5 Employee Creation Wizard - Step 3: Additional Information

**Test Case**: TC-EMP-005

- **Objective**: Verify employee creation Step 3
- **Prerequisites**: Steps 1-2 completed
- **Steps**:

1. On Step 3, enter:

- Manager: Select from dropdown (optional)
- Emergency Contact: Name and phone
- Address: Full address

2. Click "Next"

- **Expected**: Proceeds to Step 4
- **Negative Cases**:
- TC-EMP-005-N1: Invalid phone format → Validation error

### 4.6 Employee Creation Wizard - Step 4: Review & Create

**Test Case**: TC-EMP-006

- **Objective**: Verify employee creation completion
- **Prerequisites**: Steps 1-3 completed
- **Steps**:

1. On Step 4, review all entered data
2. Click "Create Employee"
3. Wait for creation

- **Expected**: 
- Employee created successfully
- Success message displayed
- Redirected to employee detail page
- Employee appears in list
- **Negative Cases**:
- TC-EMP-006-N1: API error → Error message, data not lost

### 4.7 Employee Detail View

**Test Case**: TC-EMP-007

- **Objective**: Verify employee detail page displays all information
- **Prerequisites**: Employee exists
- **Steps**:

1. Navigate to `/employees`
2. Click on an employee
3. Verify detail page loads
4. Check all tabs: Overview, Documents, History, Goals

- **Expected**: 
- All tabs load correctly
- Employee data displayed accurately
- No 404 errors
- **Tabs to Test**:
- Overview tab: Personal info, employment details
- Documents tab: Document list, upload functionality
- History tab: Audit log, change history
- Goals tab: Employee goals

### 4.8 Employee Edit

**Test Case**: TC-EMP-008

- **Objective**: Verify employee editing works
- **Prerequisites**: Employee exists
- **Steps**:

1. Navigate to employee detail page
2. Click "Edit"
3. Modify fields (including Step 2 fields: job title, department, employment type, start date)
4. Save changes
5. Verify changes persisted

- **Expected**: 
- All fields editable
- Changes save correctly
- Step 2 fields included in update
- Success message displayed
- **Negative Cases**:
- TC-EMP-008-N1: Invalid data → Validation errors
- TC-EMP-008-N2: Permission denied → Error message

### 4.9 Employee Bulk Selection

**Test Case**: TC-EMP-009

- **Objective**: Verify bulk selection functionality
- **Prerequisites**: Multiple employees exist
- **Steps**:

1. Navigate to `/employees`
2. Select multiple employees (checkboxes)
3. Verify bulk actions toolbar appears
4. Verify selected count badge

- **Expected**: 
- Selection works correctly
- Bulk toolbar appears
- Count badge accurate
- Clear button works

### 4.10 Employee Bulk Status Update

**Test Case**: TC-EMP-010

- **Objective**: Verify bulk status update
- **Prerequisites**: Multiple employees selected
- **Steps**:

1. Select 2-3 employees
2. Click "Bulk Actions" → "Update Status"
3. Select new status (e.g., "On Leave")
4. Confirm update

- **Expected**: 
- Status update dialog opens
- All status options available
- Update applies to all selected
- Success message displayed
- **Negative Cases**:
- TC-EMP-010-N1: No selection → Button disabled
- TC-EMP-010-N2: Permission denied → Error message

### 4.11 Employee Bulk Export

**Test Case**: TC-EMP-011

- **Objective**: Verify bulk export functionality
- **Prerequisites**: Employees selected
- **Steps**:

1. Select employees
2. Click "Bulk Actions" → "Export"
3. Wait for export

- **Expected**: 
- CSV file downloads
- Contains selected employees
- All fields included
- Success toast notification
- **Negative Cases**:
- TC-EMP-011-N1: No selection → Button disabled
- TC-EMP-011-N2: Export error → Error message

### 4.12 Employee Bulk Delete

**Test Case**: TC-EMP-012

- **Objective**: Verify bulk delete with confirmation
- **Prerequisites**: Employees selected, user has delete permission
- **Steps**:

1. Select employees
2. Click "Bulk Actions" → "Delete"
3. Verify warning dialog
4. Confirm deletion

- **Expected**: 
- Warning dialog shows
- Confirmation required
- Employees deleted (soft delete)
- Success message
- **Negative Cases**:
- TC-EMP-012-N1: Cancel → No deletion
- TC-EMP-012-N2: Permission denied → Error message

### 4.13 Employee Document Upload

**Test Case**: TC-EMP-013

- **Objective**: Verify document upload functionality
- **Prerequisites**: Employee exists, user has document write permission
- **Steps**:

1. Navigate to employee detail → Documents tab
2. Click "Upload Document"
3. Select file (PDF, image, etc.)
4. Select category (Contract, Certification, ID Document, etc.)
5. Enter expiry date (if applicable)
6. Upload

- **Expected**: 
- File uploads successfully
- Document appears in list
- Category assigned correctly
- Version history maintained
- **Negative Cases**:
- TC-EMP-013-N1: Invalid file type → Error message
- TC-EMP-013-N2: File too large → Error message
- TC-EMP-013-N3: Missing category → Validation error

### 4.14 Employee Document Download

**Test Case**: TC-EMP-014

- **Objective**: Verify document download
- **Prerequisites**: Employee has documents
- **Steps**:

1. Navigate to employee detail → Documents tab
2. Click download icon on a document
3. Verify download

- **Expected**: 
- Signed URL generated
- File downloads successfully
- Correct file content
- **Negative Cases**:
- TC-EMP-014-N1: Permission denied → Error message
- TC-EMP-014-N2: File not found → Error message

### 4.15 Employee Document Delete

**Test Case**: TC-EMP-015

- **Objective**: Verify document deletion
- **Prerequisites**: Employee has documents, user has delete permission
- **Steps**:

1. Navigate to employee detail → Documents tab
2. Click delete on a document
3. Confirm deletion

- **Expected**: 
- Document removed from list
- Version history maintained
- Audit log updated
- **Negative Cases**:
- TC-EMP-015-N1: Permission denied → Error message

### 4.16 Employee Audit Log

**Test Case**: TC-EMP-016

- **Objective**: Verify audit log displays changes
- **Prerequisites**: Employee with change history
- **Steps**:

1. Navigate to employee detail → History tab
2. Verify audit entries display
3. Check field-level changes
4. Verify timestamps and user attribution

- **Expected**: 
- All changes logged
- Before/after values shown
- User and timestamp accurate
- IP address logged (if configured)

### 4.17 Employee CSV Import - Preview

**Test Case**: TC-EMP-017

- **Objective**: Verify CSV import preview
- **Prerequisites**: CSV file with employee data
- **Steps**:

1. Navigate to `/employees`
2. Click "Import" button
3. Upload CSV file
4. Map columns to fields
5. Review preview

- **Expected**: 
- File validates
- Column mapping works
- Preview shows valid/invalid rows
- Errors highlighted
- **Test CSV Columns**:
- Required: name, email
- Optional: employee_number, job_title, department_name, manager_email, phone_work, start_date, employment_type, work_location, status

### 4.18 Employee CSV Import - Confirm

**Test Case**: TC-EMP-018

- **Objective**: Verify CSV import execution
- **Prerequisites**: Valid preview completed
- **Steps**:

1. After preview, click "Confirm Import"
2. Wait for processing
3. Verify results

- **Expected**: 
- Employees created/updated
- Success count displayed
- Error rows reported
- Import log available
- **Negative Cases**:
- TC-EMP-018-N1: Invalid data → Errors reported, valid rows imported
- TC-EMP-018-N2: Duplicate emails → Handled correctly

### 4.19 Employee CSV Export

**Test Case**: TC-EMP-019

- **Objective**: Verify CSV export with filters
- **Prerequisites**: Employees exist
- **Steps**:

1. Navigate to `/employees`
2. Apply filters (optional)
3. Click "Export"
4. Verify CSV download

- **Expected**: 
- CSV file downloads
- Contains filtered employees
- All fields included (or selected fields)
- Sensitive fields handled per permissions
- **Test Scenarios**:
- Export all employees
- Export with department filter
- Export with status filter
- Export with sensitive fields toggle

---

## Module 5: Organizational Management

### 5.1 Department List View

**Test Case**: TC-DEPT-001

- **Objective**: Verify department list displays
- **Prerequisites**: Departments exist
- **Steps**:

1. Navigate to `/departments`
2. Verify list loads
3. Check search functionality
4. Verify refresh button

- **Expected**: 
- All departments displayed
- Search works
- Refresh updates list
- No API errors
- **Negative Cases**:
- TC-DEPT-001-N1: No departments → Empty state
- TC-DEPT-001-N2: API error → Error message

### 5.2 Department Creation

**Test Case**: TC-DEPT-002

- **Objective**: Verify department creation
- **Prerequisites**: User with create permission
- **Steps**:

1. Navigate to `/departments`
2. Click "Add Department"
3. Enter:

- Name: `Engineering`
- Description: `Software development team`
- Parent Department: Select (optional)
- Cost Center: Enter (optional)

4. Click "Create"

- **Expected**: 
- Department created
- Appears in list
- Success message
- **Negative Cases**:
- TC-DEPT-002-N1: Duplicate name → Error message
- TC-DEPT-002-N2: Missing name → Validation error

### 5.3 Department Edit

**Test Case**: TC-DEPT-003

- **Objective**: Verify department editing
- **Prerequisites**: Department exists
- **Steps**:

1. Navigate to department list
2. Click edit on a department
3. Modify fields
4. Save

- **Expected**: 
- Changes saved
- List updates
- Success message
- **Negative Cases**:
- TC-DEPT-003-N1: Invalid parent (circular) → Validation error

### 5.4 Department Delete

**Test Case**: TC-DEPT-004

- **Objective**: Verify department deletion with dependency check
- **Prerequisites**: Department exists, user has delete permission
- **Steps**:

1. Navigate to department list
2. Click delete on a department
3. Confirm deletion

- **Expected**: 
- If no dependencies: Deleted successfully
- If has employees: Error message, not deleted
- If has child departments: Error message, not deleted
- **Negative Cases**:
- TC-DEPT-004-N1: Department with employees → Cannot delete
- TC-DEPT-004-N2: Department with children → Cannot delete

### 5.5 Department Hierarchy (Tree View)

**Test Case**: TC-DEPT-005

- **Objective**: Verify department hierarchy display
- **Prerequisites**: Departments with parent-child relationships
- **Steps**:

1. Navigate to `/departments`
2. Verify tree view displays
3. Expand/collapse nodes
4. Verify hierarchy correct

- **Expected**: 
- Tree structure displayed
- Parent-child relationships correct
- Expand/collapse works
- Department heads shown

### 5.6 Team List View

**Test Case**: TC-TEAM-001

- **Objective**: Verify team list displays
- **Prerequisites**: Teams exist
- **Steps**:

1. Navigate to `/teams`
2. Verify list loads
3. Check member counts
4. Test search

- **Expected**: 
- All teams displayed
- Member counts accurate
- Search works
- **Negative Cases**:
- TC-TEAM-001-N1: No teams → Empty state

### 5.7 Team Creation

**Test Case**: TC-TEAM-002

- **Objective**: Verify team creation
- **Prerequisites**: User with create permission
- **Steps**:

1. Navigate to `/teams`
2. Click "Add Team"
3. Enter:

- Name: `Engineering Team`
- Description: `Frontend and backend development`
- Team Lead: Select employee (optional)

4. Click "Create"

- **Expected**: 
- Team created
- Appears in list
- Success message
- **Negative Cases**:
- TC-TEAM-002-N1: Duplicate name → Error message

### 5.8 Team Member Management

**Test Case**: TC-TEAM-003

- **Objective**: Verify adding/removing team members
- **Prerequisites**: Team exists, employees exist
- **Steps**:

1. Navigate to team detail
2. Click "Add Member"
3. Select employee
4. Confirm
5. Verify member added
6. Remove member
7. Verify member removed

- **Expected**: 
- Members added successfully
- Members removed successfully
- Member count updates
- List refreshes

### 5.9 Office Location List View

**Test Case**: TC-LOC-001

- **Objective**: Verify office location list displays
- **Prerequisites**: Office locations exist
- **Steps**:

1. Navigate to `/office-locations`
2. Verify list loads
3. Test search
4. Test refresh

- **Expected**: 
- All locations displayed
- Search works
- Refresh updates list
- **Negative Cases**:
- TC-LOC-001-N1: No locations → Empty state

### 5.10 Office Location Creation

**Test Case**: TC-LOC-002

- **Objective**: Verify office location creation
- **Prerequisites**: User with create permission
- **Steps**:

1. Navigate to `/office-locations`
2. Click "Add Location"
3. Enter:

- Name: `San Francisco Headquarters`
- Address: `123 Market St, San Francisco, CA 94105`
- Timezone: `America/Los_Angeles`

4. Click "Create"

- **Expected**: 
- Location created
- Appears in list
- Success message
- **Negative Cases**:
- TC-LOC-002-N1: Invalid timezone → Validation error

### 5.11 Office Location Edit

**Test Case**: TC-LOC-003

- **Objective**: Verify office location editing
- **Prerequisites**: Location exists
- **Steps**:

1. Navigate to location list
2. Click edit
3. Modify fields
4. Save

- **Expected**: 
- Changes saved
- List updates
- Success message

### 5.12 Office Location Delete

**Test Case**: TC-LOC-004

- **Objective**: Verify office location deletion
- **Prerequisites**: Location exists, user has delete permission
- **Steps**:

1. Navigate to location list
2. Click delete
3. Confirm deletion

- **Expected**: 
- If unused: Deleted successfully
- If has employees: Error message, not deleted
- **Negative Cases**:
- TC-LOC-004-N1: Location with employees → Cannot delete

---

## Module 6: Time & Attendance Management

### 6.1 Clock In

**Test Case**: TC-TIME-001

- **Objective**: Verify clock in functionality
- **Prerequisites**: User logged in, not currently clocked in
- **Steps**:

1. Navigate to dashboard or `/time/entries`
2. Click "Clock In"
3. Verify clock in time recorded

- **Expected**: 
- Clock in successful
- Time entry created
- Status shows "Clocked In"
- Location tracked (if enabled)
- **Negative Cases**:
- TC-TIME-001-N1: Already clocked in → Error message
- TC-TIME-001-N2: Multiple active entries → Prevented

### 6.2 Clock Out

**Test Case**: TC-TIME-002

- **Objective**: Verify clock out functionality
- **Prerequisites**: User clocked in
- **Steps**:

1. Click "Clock Out"
2. Enter break duration (if applicable)
3. Confirm

- **Expected**: 
- Clock out successful
- Duration calculated correctly
- Break time deducted
- Time entry completed
- **Negative Cases**:
- TC-TIME-002-N1: Not clocked in → Error message

### 6.3 Manual Time Entry Creation

**Test Case**: TC-TIME-003

- **Objective**: Verify manual time entry creation
- **Prerequisites**: User logged in
- **Steps**:

1. Navigate to `/time/entries` or use Quick Actions
2. Click "Add Time Entry"
3. Enter:

- Date: `2025-01-15`
- Start Time: `09:00`
- End Time: `17:00`
- Break Duration: `60` minutes
- Project: Select (optional)
- Notes: `Working on feature X`

4. Submit

- **Expected**: 
- Entry created
- Appears in list
- Requires approval (if configured)
- Net hours calculated (total - break)
- **Negative Cases**:
- TC-TIME-003-N1: Overlapping entries → Validation error
- TC-TIME-003-N2: End before start → Validation error
- TC-TIME-003-N3: Invalid date → Validation error

### 6.4 Time Entries List View

**Test Case**: TC-TIME-004

- **Objective**: Verify time entries list displays correctly
- **Prerequisites**: Time entries exist
- **Steps**:

1. Navigate to `/time/entries`
2. Verify table loads
3. Check all columns display
4. Verify Net Hours column present
5. Test filtering
6. Test pagination

- **Expected**: 
- All entries displayed
- Columns: Date, Clock In, Clock Out, Break, Total, Net Hours, Project, Type, Status
- Net Hours = Total Duration - Break Duration
- Filters work
- Pagination works
- **Negative Cases**:
- TC-TIME-004-N1: No entries → Empty state

### 6.5 Time Entry Edit

**Test Case**: TC-TIME-005

- **Objective**: Verify time entry editing
- **Prerequisites**: Time entry exists (pending or approved)
- **Steps**:

1. Navigate to time entries list
2. Click edit on an entry
3. Modify times
4. Save

- **Expected**: 
- If pending: Editable, changes saved
- If approved: May require re-approval
- Net hours recalculated
- **Negative Cases**:
- TC-TIME-005-N1: Cannot edit approved entry → Error or re-approval required

### 6.6 Time Entry Delete

**Test Case**: TC-TIME-006

- **Objective**: Verify time entry deletion
- **Prerequisites**: Time entry exists, user has delete permission
- **Steps**:

1. Navigate to time entries list
2. Click delete on an entry
3. Confirm deletion

- **Expected**: 
- Entry deleted
- Removed from list
- Success message
- **Negative Cases**:
- TC-TIME-006-N1: Cannot delete approved entry → Error message

### 6.7 Time Entry Approvals List

**Test Case**: TC-TIME-007

- **Objective**: Verify pending approvals display
- **Prerequisites**: Manager role, pending time entries exist
- **Steps**:

1. Navigate to `/time/approvals`
2. Verify pending entries list
3. Check pending count badge

- **Expected**: 
- Pending entries displayed
- Count badge accurate
- Entry details shown
- Empty state if no pending
- **Negative Cases**:
- TC-TIME-007-N1: No pending → Empty state message

### 6.8 Time Entry Approval

**Test Case**: TC-TIME-008

- **Objective**: Verify time entry approval
- **Prerequisites**: Pending time entry exists, manager role
- **Steps**:

1. Navigate to `/time/approvals`
2. Click "Approve" on an entry
3. Confirm approval

- **Expected**: 
- Entry approved
- Status updated
- Removed from pending list
- Success message
- **Negative Cases**:
- TC-TIME-008-N1: Already approved → Handled gracefully

### 6.9 Time Entry Rejection

**Test Case**: TC-TIME-009

- **Objective**: Verify time entry rejection
- **Prerequisites**: Pending time entry exists, manager role
- **Steps**:

1. Navigate to `/time/approvals`
2. Click "Reject" on an entry
3. Enter rejection reason
4. Confirm rejection

- **Expected**: 
- Entry rejected
- Reason saved
- Status updated
- Removed from pending list
- **Negative Cases**:
- TC-TIME-009-N1: Missing reason → Validation error

### 6.10 Time Entry Audit Trail

**Test Case**: TC-TIME-010

- **Objective**: Verify audit trail displays
- **Prerequisites**: Time entry with changes
- **Steps**:

1. Navigate to time entry detail
2. View audit log
3. Verify change history

- **Expected**: 
- All changes logged
- Timestamps accurate
- User attribution correct
- Before/after values shown

### 6.11 Overtime Balance View

**Test Case**: TC-TIME-011

- **Objective**: Verify overtime balance display
- **Prerequisites**: User has overtime entries
- **Steps**:

1. Navigate to `/time/overtime`
2. Verify balance displayed
3. Check period-based tracking

- **Expected**: 
- Current balance shown
- Period information displayed
- History available
- **Negative Cases**:
- TC-TIME-011-N1: No overtime → Zero balance shown

### 6.12 Overtime Calculation

**Test Case**: TC-TIME-012

- **Objective**: Verify overtime calculation
- **Prerequisites**: Time entries exceeding threshold
- **Steps**:

1. Navigate to `/time/overtime`
2. Request calculation for a period
3. Verify calculation

- **Expected**: 
- Overtime calculated correctly
- Based on configured rules
- Balance updated
- **Test Scenarios**:
- Daily overtime (over 8 hours)
- Weekly overtime (over 40 hours)
- Different multipliers (1.5x, 2x)

### 6.13 Team Calendar View - Day

**Test Case**: TC-TIME-013

- **Objective**: Verify day view calendar
- **Prerequisites**: Team members with time entries
- **Steps**:

1. Navigate to `/calendar`
2. Click "Day View"
3. Verify single day displayed
4. Check hourly slots
5. Verify time entries shown

- **Expected**: 
- Day view displays correctly
- Hourly slots visible
- Time entries color-coded
- Navigation works

### 6.14 Team Calendar View - Week

**Test Case**: TC-TIME-014

- **Objective**: Verify week view calendar
- **Prerequisites**: Team members with time entries
- **Steps**:

1. Navigate to `/calendar`
2. Click "Week View"
3. Verify 7-day week displayed
4. Check hourly slots
5. Verify time entries shown

- **Expected**: 
- Week view displays correctly
- 7 days visible
- Time entries shown
- Navigation works

### 6.15 Team Calendar View - Month

**Test Case**: TC-TIME-015

- **Objective**: Verify month view calendar
- **Prerequisites**: Team members with time entries
- **Steps**:

1. Navigate to `/calendar`
2. Click "Month View"
3. Verify full month grid displayed
4. Verify time entries shown

- **Expected**: 
- Month view displays correctly
- Full month grid
- Time entries shown
- Navigation works

### 6.16 Calendar Navigation

**Test Case**: TC-TIME-016

- **Objective**: Verify calendar navigation controls
- **Prerequisites**: Calendar page loaded
- **Steps**:

1. Navigate to `/calendar`
2. Test "Previous" button
3. Test "Next" button
4. Test "Today" button
5. Verify date range updates

- **Expected**: 
- All navigation buttons work
- Date range updates correctly
- View persists across navigation

### 6.17 Time Export (CSV)

**Test Case**: TC-TIME-017

- **Objective**: Verify time entries CSV export
- **Prerequisites**: Time entries exist
- **Steps**:

1. Navigate to `/time/entries`
2. Apply filters (optional)
3. Click "Export"
4. Select date range
5. Download CSV

- **Expected**: 
- CSV file downloads
- Contains filtered entries
- All columns included
- Date range respected
- **Test Scenarios**:
- Export all entries
- Export with date filter
- Export with status filter

---

## Module 7: Leave & Absence Management

### 7.1 Leave Balance Display

**Test Case**: TC-LEAVE-001

- **Objective**: Verify leave balances display correctly
- **Prerequisites**: User has leave balances
- **Steps**:

1. Navigate to `/leave/requests` or dashboard
2. Verify leave balance widget/section
3. Check all leave types shown
4. Verify balance amounts
5. Check progress bars

- **Expected**: 
- All leave types displayed
- Balances match database
- Progress bars render
- Certificate requirements shown
- Total balance calculated
- **Negative Cases**:
- TC-LEAVE-001-N1: No balances → Empty state or zero

### 7.2 Leave Request Creation

**Test Case**: TC-LEAVE-002

- **Objective**: Verify leave request submission
- **Prerequisites**: User has leave balance
- **Steps**:

1. Navigate to `/leave/requests`
2. Click "Request Time Off"
3. Select leave type
4. Select start date
5. Select end date
6. Verify working days calculated (excludes weekends/holidays)
7. Select half-day option (if applicable)
8. Add notes (optional)
9. Upload certificate (if required)
10. Submit

- **Expected**: 
- Request created
- Working days calculated correctly
- Balance validated
- Status: Pending
- Appears in requests list
- **Negative Cases**:
- TC-LEAVE-002-N1: Insufficient balance → Validation error
- TC-LEAVE-002-N2: Overlapping requests → Validation error
- TC-LEAVE-002-N3: Blackout period → Validation error
- TC-LEAVE-002-N4: Missing certificate → Validation error
- TC-LEAVE-002-N5: Invalid date range → Validation error

### 7.3 Leave Request List View

**Test Case**: TC-LEAVE-003

- **Objective**: Verify leave requests list displays
- **Prerequisites**: Leave requests exist
- **Steps**:

1. Navigate to `/leave/requests`
2. Verify list loads
3. Check filtering options
4. Verify status badges
5. Test search

- **Expected**: 
- All requests displayed
- Filters work (status, type, date range)
- Status badges color-coded
- Search works
- **Negative Cases**:
- TC-LEAVE-003-N1: No requests → Empty state

### 7.4 Leave Request Edit (Pending)

**Test Case**: TC-LEAVE-004

- **Objective**: Verify pending request editing
- **Prerequisites**: Pending leave request exists
- **Steps**:

1. Navigate to `/leave/requests`
2. Click edit on pending request
3. Modify dates or type
4. Save

- **Expected**: 
- Changes saved
- Working days recalculated
- Balance re-validated
- Status remains pending
- **Negative Cases**:
- TC-LEAVE-004-N1: Cannot edit approved → Error message
- TC-LEAVE-004-N2: Cannot edit denied → Error message

### 7.5 Leave Request Cancellation

**Test Case**: TC-LEAVE-005

- **Objective**: Verify leave request cancellation
- **Prerequisites**: Leave request exists (pending or approved)
- **Steps**:

1. Navigate to `/leave/requests`
2. Click cancel on a request
3. Confirm cancellation

- **Expected**: 
- Request cancelled
- Status updated
- Balance reversed (if approved)
- Removed from pending approvals (if pending)
- **Negative Cases**:
- TC-LEAVE-005-N1: Cannot cancel denied → Error message

### 7.6 Leave Approval List

**Test Case**: TC-LEAVE-006

- **Objective**: Verify pending approvals display
- **Prerequisites**: Manager role, pending requests exist
- **Steps**:

1. Navigate to `/leave/approvals`
2. Verify pending requests list
3. Check request details
4. Verify empty state if no pending

- **Expected**: 
- Pending requests displayed
- Request details shown (employee, type, dates, duration)
- Empty state if no pending
- **Negative Cases**:
- TC-LEAVE-006-N1: No pending → Empty state message

### 7.7 Leave Request Approval

**Test Case**: TC-LEAVE-007

- **Objective**: Verify leave request approval workflow
- **Prerequisites**: Pending request exists, manager role
- **Steps**:

1. Navigate to `/leave/approvals`
2. Click "Approve" on a request
3. Verify confirmation dialog shows request details
4. Confirm approval
5. Verify success message

- **Expected**: 
- Confirmation dialog shows: employee name, leave type, duration, dates
- Request approved
- Status updated to "approved"
- Balance decreased (used_ytd incremented)
- Request removed from pending list
- Success toast: "Leave request from [employee] has been approved"
- **Negative Cases**:
- TC-LEAVE-007-N1: Already approved → Handled gracefully (idempotent)
- TC-LEAVE-007-N2: Cancelled request → Error: "Cannot approve or deny a cancelled request"
- TC-LEAVE-007-N3: Insufficient permissions → Error: "You don't have permission to approve this request"

### 7.8 Leave Request Denial

**Test Case**: TC-LEAVE-008

- **Objective**: Verify leave request denial workflow
- **Prerequisites**: Pending request exists, manager role
- **Steps**:

1. Navigate to `/leave/approvals`
2. Click "Deny" on a request
3. Enter denial reason (required)
4. Confirm denial

- **Expected**: 
- Request denied
- Reason saved
- Status updated to "denied"
- Balance unchanged (if pending)
- Request removed from pending list
- Success toast: "Leave request from [employee] has been denied"
- **Negative Cases**:
- TC-LEAVE-008-N1: Missing reason → Validation error: "Denial reason is required"
- TC-LEAVE-008-N2: Already denied → Handled gracefully (idempotent)
- TC-LEAVE-008-N3: Cancelled request → Error: "Cannot approve or deny a cancelled request"
- TC-LEAVE-008-N4: Denying approved request → Balance reversed (used_ytd decremented)

### 7.9 Leave Balance Management - View

**Test Case**: TC-LEAVE-009

- **Objective**: Verify balance management page loads
- **Prerequisites**: Admin role
- **Steps**:

1. Navigate to `/leave/admin`
2. Click "Balance Management" tab
3. Verify page loads
4. Check employee dropdown
5. Check leave type dropdown
6. Verify current balance display
7. Verify all balances table

- **Expected**: 
- Page loads without errors
- Employee dropdown populated
- Leave type dropdown populated
- Current balance displays when employee/type selected
- All balances table shows all employee balances
- **Negative Cases**:
- TC-LEAVE-009-N1: No employees → Empty state
- TC-LEAVE-009-N2: No leave types → Error message

### 7.10 Leave Balance Adjustment - Positive

**Test Case**: TC-LEAVE-010

- **Objective**: Verify positive balance adjustment
- **Prerequisites**: Admin role, employee and leave type exist
- **Steps**:

1. Navigate to `/leave/admin` → Balance Management
2. Select employee from dropdown
3. Select leave type
4. View current balance (e.g., 20.0 days)
5. Enter adjustment: `+3` days
6. Enter reason: `Annual allocation`
7. Enter notes (optional)
8. Click "Apply Adjustment"

- **Expected**: 
- Adjustment applied successfully
- Balance increases: 20.0 → 23.0 days
- Success message: "Successfully added 3 days to balance"
- All balances table updates
- Form resets
- Current balance display updates
- **Negative Cases**:
- TC-LEAVE-010-N1: Zero adjustment → Error: "Adjustment days must be a valid non-zero number"
- TC-LEAVE-010-N2: Missing reason → Validation error: "Please fill in all required fields"
- TC-LEAVE-010-N3: Non-existent employee → Error: "Employee not found"
- TC-LEAVE-010-N4: Non-existent leave type → Error: "Leave type not found"
- TC-LEAVE-010-N5: Insufficient permissions → Error: "You don't have permission to adjust balances"

### 7.11 Leave Balance Adjustment - Negative

**Test Case**: TC-LEAVE-011

- **Objective**: Verify negative balance adjustment
- **Prerequisites**: Admin role, employee with balance exists
- **Steps**:

1. Navigate to `/leave/admin` → Balance Management
2. Select employee
3. Select leave type
4. View current balance (e.g., 23.0 days)
5. Enter adjustment: `-2` days
6. Enter reason: `Correction`
7. Click "Apply Adjustment"

- **Expected**: 
- Adjustment applied successfully
- Balance decreases: 23.0 → 21.0 days
- Success message: "Successfully subtracted 2 days from balance"
- All balances table updates
- Form resets
- **Negative Cases**:
- TC-LEAVE-011-N1: Negative adjustment exceeds balance → Validation error (if enforced)
- TC-LEAVE-011-N2: Zero adjustment → Error: "Adjustment days must be a valid non-zero number"

### 7.12 Holiday Calendar Management - List

**Test Case**: TC-LEAVE-012

- **Objective**: Verify holiday list displays
- **Prerequisites**: Admin role, holidays exist
- **Steps**:

1. Navigate to `/leave/admin`
2. Click "Holiday Calendar" tab
3. Verify holidays list

- **Expected**: 
- All holidays displayed
- Dates formatted correctly
- Half-day indicators shown
- **Negative Cases**:
- TC-LEAVE-012-N1: No holidays → Empty state

### 7.13 Holiday Calendar Management - Add

**Test Case**: TC-LEAVE-013

- **Objective**: Verify holiday creation
- **Prerequisites**: Admin role
- **Steps**:

1. Navigate to `/leave/admin` → Holiday Calendar
2. Click "Add Holiday"
3. Enter:

- Name: `New Year's Day`
- Da