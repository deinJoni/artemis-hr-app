-- Leave & Absence Analytics Views
-- This migration creates materialized views for leave analytics and reporting

-- ==============================================
-- 1. LEAVE UTILIZATION SUMMARY VIEW
-- ==============================================

CREATE OR REPLACE VIEW public.leave_utilization_summary AS
SELECT 
  lb.tenant_id,
  lb.employee_id,
  e.name as employee_name,
  e.email as employee_email,
  e.department_id,
  d.name as department_name,
  lb.leave_type_id,
  lt.name as leave_type_name,
  lt.code as leave_type_code,
  DATE_TRUNC('month', tor.start_date)::DATE as period_month,
  DATE_TRUNC('year', tor.start_date)::DATE as period_year,
  COUNT(DISTINCT tor.id) as request_count,
  COALESCE(SUM(tor.days_count), 0) as days_taken,
  MAX(lb.balance_days) as balance_at_period_start,
  MAX(lb.used_ytd) as used_ytd_total,
  CASE 
    WHEN MAX(lb.balance_days) > 0 THEN 
      ROUND((COALESCE(SUM(tor.days_count), 0)::NUMERIC / MAX(lb.balance_days)) * 100, 2)
    ELSE 0
  END as utilization_rate
FROM public.leave_balances lb
LEFT JOIN public.employees e ON lb.employee_id = e.id
LEFT JOIN public.departments d ON e.department_id = d.id
LEFT JOIN public.leave_types lt ON lb.leave_type_id = lt.id
LEFT JOIN public.time_off_requests tor ON 
  tor.user_id = e.user_id 
  AND tor.tenant_id = lb.tenant_id
  AND tor.leave_type_id = lb.leave_type_id
  AND tor.status = 'approved'
  AND DATE_TRUNC('month', tor.start_date)::DATE = DATE_TRUNC('month', lb.period_start)::DATE
WHERE lb.period_start <= CURRENT_DATE AND lb.period_end >= CURRENT_DATE
GROUP BY 
  lb.tenant_id,
  lb.employee_id,
  e.name,
  e.email,
  e.department_id,
  d.name,
  lb.leave_type_id,
  lt.name,
  lt.code,
  DATE_TRUNC('month', tor.start_date)::DATE,
  DATE_TRUNC('year', tor.start_date)::DATE;

-- Add indexes for performance (indexes on views are created on underlying tables)
CREATE INDEX IF NOT EXISTS time_off_requests_analytics_idx 
  ON public.time_off_requests (tenant_id, user_id, leave_type_id, status, start_date)
  WHERE status = 'approved';

-- ==============================================
-- 2. LEAVE TRENDS MONTHLY VIEW
-- ==============================================

CREATE OR REPLACE VIEW public.leave_trends_monthly AS
SELECT 
  tor.tenant_id,
  DATE_TRUNC('month', tor.start_date)::DATE as month,
  tor.leave_type_id,
  lt.name as leave_type_name,
  lt.code as leave_type_code,
  COUNT(DISTINCT tor.id) as request_count,
  COUNT(DISTINCT e.id) as employee_count,
  COALESCE(SUM(tor.days_count), 0) as total_days,
  AVG(tor.days_count) as avg_days_per_request,
  MIN(tor.days_count) as min_days,
  MAX(tor.days_count) as max_days
FROM public.time_off_requests tor
JOIN public.leave_types lt ON tor.leave_type_id = lt.id
LEFT JOIN public.employees e ON tor.user_id = e.user_id AND tor.tenant_id = e.tenant_id
WHERE tor.status = 'approved'
GROUP BY 
  tor.tenant_id,
  DATE_TRUNC('month', tor.start_date)::DATE,
  tor.leave_type_id,
  lt.name,
  lt.code;

-- ==============================================
-- 3. LEAVE BALANCE FORECAST VIEW
-- ==============================================

CREATE OR REPLACE VIEW public.leave_balance_forecast AS
SELECT 
  lb.tenant_id,
  lb.employee_id,
  e.name as employee_name,
  e.email as employee_email,
  lb.leave_type_id,
  lt.name as leave_type_name,
  lt.code as leave_type_code,
  lb.balance_days as current_balance,
  lb.period_end,
  COALESCE(SUM(CASE WHEN tor.status = 'approved' THEN tor.days_count ELSE 0 END), 0) as approved_days_pending,
  COALESCE(SUM(CASE WHEN tor.status = 'pending' THEN tor.days_count ELSE 0 END), 0) as pending_days_requested,
  (lb.balance_days - COALESCE(SUM(CASE WHEN tor.status = 'approved' THEN tor.days_count ELSE 0 END), 0)) as projected_balance,
  CASE 
    WHEN lb.period_end > CURRENT_DATE THEN 
      (lb.period_end - CURRENT_DATE)::INTEGER
    ELSE 0
  END as days_until_period_end
FROM public.leave_balances lb
JOIN public.employees e ON lb.employee_id = e.id
JOIN public.leave_types lt ON lb.leave_type_id = lt.id
LEFT JOIN public.time_off_requests tor ON 
  tor.user_id = e.user_id 
  AND tor.tenant_id = lb.tenant_id
  AND tor.leave_type_id = lb.leave_type_id
  AND tor.start_date > CURRENT_DATE
  AND tor.status IN ('approved', 'pending')
WHERE lb.period_start <= CURRENT_DATE AND lb.period_end >= CURRENT_DATE
GROUP BY 
  lb.tenant_id,
  lb.employee_id,
  e.name,
  e.email,
  lb.leave_type_id,
  lt.name,
  lt.code,
  lb.balance_days,
  lb.period_end;

-- ==============================================
-- 4. ADDITIONAL INDEXES FOR ANALYTICS PERFORMANCE
-- ==============================================

CREATE INDEX IF NOT EXISTS time_off_requests_month_idx 
  ON public.time_off_requests (tenant_id, start_date, status);

CREATE INDEX IF NOT EXISTS leave_balances_current_period_idx 
  ON public.leave_balances (tenant_id, period_start, period_end);

COMMENT ON VIEW public.leave_utilization_summary IS 'Aggregated leave utilization metrics by employee, department, leave type, and month/year';
COMMENT ON VIEW public.leave_trends_monthly IS 'Monthly aggregates of leave taken by type with statistical summaries';
COMMENT ON VIEW public.leave_balance_forecast IS 'Projected leave balances based on current balance and pending/approved requests';

