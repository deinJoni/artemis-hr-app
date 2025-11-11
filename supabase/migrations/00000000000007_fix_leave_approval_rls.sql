-- Fix RLS policy for time_off_requests approval updates
-- The backend checks for 'leave.approve_requests' but the policy was checking 'time_off.approve'
-- This migration updates the policy to match the backend permission check

drop policy if exists time_off_requests_update_approvers on public.time_off_requests;

create policy time_off_requests_update_approvers on public.time_off_requests
for update to authenticated
using (public.app_has_permission('leave.approve_requests', tenant_id))
with check (public.app_has_permission('leave.approve_requests', tenant_id));

