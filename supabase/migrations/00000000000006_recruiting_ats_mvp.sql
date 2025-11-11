-- Recruiting ATS MVP Migration
-- This migration creates tables for recruiting and applicant tracking system
-- Includes: jobs, job_postings, candidates, applications, pipeline_stages, interviews, evaluations, communications, talent_pool

-- ==============================================
-- 1. JOBS TABLE
-- ==============================================

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  job_id text not null, -- Auto-generated unique identifier (e.g., JOB-2024-001)
  title text not null,
  department_id uuid references public.departments(id) on delete set null,
  location_id uuid references public.office_locations(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'pending_approval', 'active', 'paused', 'filled', 'closed')),
  description text not null,
  requirements jsonb, -- Skills, experience, education requirements
  employment_type text check (employment_type in ('full_time', 'part_time', 'contract', 'freelance')),
  work_location text check (work_location in ('remote', 'hybrid', 'on_site')),
  salary_min numeric(12,2),
  salary_max numeric(12,2),
  salary_currency text default 'USD',
  salary_hidden boolean not null default false,
  benefits jsonb, -- Array of benefits/perks
  application_deadline date,
  created_by uuid not null references auth.users(id) on delete cascade,
  approved_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, job_id)
);

create index if not exists jobs_tenant_idx on public.jobs (tenant_id);
create index if not exists jobs_status_idx on public.jobs (tenant_id, status);
create index if not exists jobs_department_idx on public.jobs (tenant_id, department_id);
create index if not exists jobs_location_idx on public.jobs (tenant_id, location_id);
create index if not exists jobs_created_by_idx on public.jobs (tenant_id, created_by);
create index if not exists jobs_job_id_idx on public.jobs (tenant_id, job_id);

-- ==============================================
-- 2. JOB POSTINGS TABLE (Channel Distribution Tracking)
-- ==============================================

create table if not exists public.job_postings (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  channel text not null check (channel in ('linkedin', 'indeed', 'stepstone', 'jobs_bg', 'glassdoor', 'company_site', 'instagram', 'facebook', 'tiktok', 'other')),
  posted_at timestamptz,
  budget numeric(12,2),
  spent numeric(12,2) default 0,
  status text not null default 'pending' check (status in ('pending', 'active', 'paused', 'completed', 'failed')),
  external_post_id text, -- ID from external job board if available
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_postings_job_idx on public.job_postings (job_id);
create index if not exists job_postings_channel_idx on public.job_postings (job_id, channel);
create index if not exists job_postings_status_idx on public.job_postings (job_id, status);

-- ==============================================
-- 3. CANDIDATES TABLE
-- ==============================================

create table if not exists public.candidates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  email text not null,
  phone text,
  resume_url text, -- Storage path in Supabase Storage
  cover_letter text,
  linkedin_url text,
  portfolio_url text,
  source text not null check (source in ('direct_apply', 'linkedin', 'indeed', 'referral', 'job_board', 'social_media', 'event', 'qr_code', 'other')),
  source_details jsonb, -- Additional tracking info (UTM params, QR code ID, etc.)
  applied_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists candidates_tenant_idx on public.candidates (tenant_id);
create index if not exists candidates_email_idx on public.candidates (tenant_id, email);
create index if not exists candidates_source_idx on public.candidates (tenant_id, source);
create index if not exists candidates_applied_at_idx on public.candidates (tenant_id, applied_at desc);

-- ==============================================
-- 4. APPLICATIONS TABLE (Links Candidates to Jobs)
-- ==============================================

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  status text not null default 'applied' check (status in ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected')),
  current_stage_id uuid, -- References pipeline_stages
  match_score integer check (match_score >= 0 and match_score <= 100),
  application_answers jsonb, -- Custom questions and answers
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, candidate_id)
);

create index if not exists applications_job_idx on public.applications (job_id);
create index if not exists applications_candidate_idx on public.applications (candidate_id);
create index if not exists applications_status_idx on public.applications (job_id, status);
create index if not exists applications_stage_idx on public.applications (job_id, current_stage_id);

-- ==============================================
-- 5. PIPELINE STAGES TABLE (Customizable Stages per Job)
-- ==============================================

create table if not exists public.pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  name text not null,
  order_index integer not null,
  stage_type text not null check (stage_type in ('applied', 'screening', 'interview', 'offer', 'hired', 'rejected', 'custom')),
  auto_action jsonb, -- Stage-specific actions (e.g., auto-send email)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, name),
  unique (job_id, order_index)
);

create index if not exists pipeline_stages_job_idx on public.pipeline_stages (job_id);
create index if not exists pipeline_stages_order_idx on public.pipeline_stages (job_id, order_index);

-- ==============================================
-- 6. INTERVIEWS TABLE
-- ==============================================

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  type text not null check (type in ('phone_screen', 'video', 'in_person', 'panel', 'technical_assessment')),
  scheduled_at timestamptz not null,
  duration_minutes integer default 60,
  location text, -- Physical location or video link
  meeting_link text, -- Video call URL
  interviewer_ids jsonb not null, -- Array of user IDs
  notes text,
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists interviews_application_idx on public.interviews (application_id);
create index if not exists interviews_scheduled_at_idx on public.interviews (scheduled_at);
create index if not exists interviews_status_idx on public.interviews (status);

-- ==============================================
-- 7. EVALUATIONS TABLE (Interview Scorecards)
-- ==============================================

create table if not exists public.evaluations (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.interviews(id) on delete cascade,
  evaluator_id uuid not null references auth.users(id) on delete cascade,
  scores jsonb not null, -- { "technical_skills": 4, "communication": 5, "culture_fit": 4, ... }
  notes text,
  overall_rating integer check (overall_rating >= 1 and overall_rating <= 10),
  recommendation text check (recommendation in ('strong_yes', 'yes', 'maybe', 'no', 'strong_no')),
  submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (interview_id, evaluator_id)
);

create index if not exists evaluations_interview_idx on public.evaluations (interview_id);
create index if not exists evaluations_evaluator_idx on public.evaluations (evaluator_id);

-- ==============================================
-- 8. COMMUNICATIONS TABLE (Email/SMS Logs)
-- ==============================================

create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  type text not null check (type in ('email', 'sms', 'whatsapp')),
  direction text not null check (direction in ('outbound', 'inbound')),
  subject text, -- For emails
  content text not null,
  template_id uuid, -- References email templates (future table)
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'sent', 'delivered', 'opened', 'clicked', 'failed', 'bounced')),
  sent_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists communications_tenant_candidate_idx on public.communications (tenant_id, candidate_id);
create index if not exists communications_type_idx on public.communications (tenant_id, type);
create index if not exists communications_sent_at_idx on public.communications (tenant_id, sent_at desc);

-- ==============================================
-- 9. TALENT POOL TABLE
-- ==============================================

create table if not exists public.talent_pool (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  candidate_id uuid not null references public.candidates(id) on delete cascade,
  added_at timestamptz not null default now(),
  added_by uuid references auth.users(id) on delete set null,
  engagement_score integer check (engagement_score >= 0 and engagement_score <= 100),
  tags text[], -- Array of tags
  notes text,
  last_contact_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, candidate_id)
);

create index if not exists talent_pool_tenant_idx on public.talent_pool (tenant_id);
create index if not exists talent_pool_candidate_idx on public.talent_pool (candidate_id);
create index if not exists talent_pool_engagement_idx on public.talent_pool (tenant_id, engagement_score desc);
create index if not exists talent_pool_tags_idx on public.talent_pool using gin (tags);

-- ==============================================
-- 10. TRIGGERS
-- ==============================================

create trigger set_updated_at_on_jobs
before update on public.jobs
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_job_postings
before update on public.job_postings
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_candidates
before update on public.candidates
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_applications
before update on public.applications
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_pipeline_stages
before update on public.pipeline_stages
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_interviews
before update on public.interviews
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_evaluations
before update on public.evaluations
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_communications
before update on public.communications
for each row
execute function public.set_updated_at();

create trigger set_updated_at_on_talent_pool
before update on public.talent_pool
for each row
execute function public.set_updated_at();

-- ==============================================
-- 11. HELPER FUNCTION: Generate Job ID
-- ==============================================

create or replace function public.generate_job_id(tenant_uuid uuid)
returns text
language plpgsql
as $$
declare
  year_part text;
  sequence_num integer;
  job_num text;
begin
  year_part := extract(year from current_date)::text;
  
  select coalesce(max(cast(substring(job_id from 9) as integer)), 0) + 1
  into sequence_num
  from public.jobs
  where tenant_id = tenant_uuid
    and job_id like 'JOB-' || year_part || '-%';
  
  job_num := 'JOB-' || year_part || '-' || lpad(sequence_num::text, 4, '0');
  
  return job_num;
end;
$$;

-- Trigger function to auto-generate job_id
create or replace function public.job_before_insert()
returns trigger
language plpgsql
as $$
begin
  if new.job_id is null or new.job_id = '' then
    new.job_id := public.generate_job_id(new.tenant_id);
  end if;
  
  return new;
end;
$$;

create trigger job_before_insert_trigger
before insert on public.jobs
for each row
execute function public.job_before_insert();

-- ==============================================
-- 12. HELPER FUNCTION: Create Default Pipeline Stages
-- ==============================================

create or replace function public.create_default_pipeline_stages(job_uuid uuid)
returns void
language plpgsql
as $$
begin
  insert into public.pipeline_stages (job_id, name, order_index, stage_type)
  values
    (job_uuid, 'Applied', 1, 'applied'),
    (job_uuid, 'Screening', 2, 'screening'),
    (job_uuid, 'Interview', 3, 'interview'),
    (job_uuid, 'Offer', 4, 'offer'),
    (job_uuid, 'Hired', 5, 'hired'),
    (job_uuid, 'Rejected', 6, 'rejected')
  on conflict (job_id, name) do nothing;
end;
$$;

-- Trigger to create default stages when job is created
create or replace function public.job_after_insert()
returns trigger
language plpgsql
as $$
begin
  perform public.create_default_pipeline_stages(new.id);
  return new;
end;
$$;

create trigger job_after_insert_trigger
after insert on public.jobs
for each row
execute function public.job_after_insert();

-- ==============================================
-- 13. ROW LEVEL SECURITY
-- ==============================================

alter table public.jobs enable row level security;
alter table public.job_postings enable row level security;
alter table public.candidates enable row level security;
alter table public.applications enable row level security;
alter table public.pipeline_stages enable row level security;
alter table public.interviews enable row level security;
alter table public.evaluations enable row level security;
alter table public.communications enable row level security;
alter table public.talent_pool enable row level security;

-- Jobs policies
create policy jobs_read on public.jobs
for select to authenticated
using (public.app_has_permission('recruiting.jobs.read', tenant_id));

create policy jobs_write on public.jobs
for all to authenticated
using (public.app_has_permission('recruiting.jobs.write', tenant_id))
with check (public.app_has_permission('recruiting.jobs.write', tenant_id));

-- Job postings policies
create policy job_postings_read on public.job_postings
for select to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.id = job_postings.job_id
    and public.app_has_permission('recruiting.jobs.read', j.tenant_id)
  )
);

create policy job_postings_write on public.job_postings
for all to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.id = job_postings.job_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
)
with check (
  exists (
    select 1 from public.jobs j
    where j.id = job_postings.job_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
);

-- Candidates policies
create policy candidates_read on public.candidates
for select to authenticated
using (public.app_has_permission('recruiting.candidates.read', tenant_id));

create policy candidates_write on public.candidates
for all to authenticated
using (public.app_has_permission('recruiting.candidates.write', tenant_id))
with check (public.app_has_permission('recruiting.candidates.write', tenant_id));

-- Applications policies
create policy applications_read on public.applications
for select to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.id = applications.job_id
    and public.app_has_permission('recruiting.jobs.read', j.tenant_id)
  )
);

create policy applications_write on public.applications
for all to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.id = applications.job_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
)
with check (
  exists (
    select 1 from public.jobs j
    where j.id = applications.job_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
);

-- Pipeline stages policies
create policy pipeline_stages_read on public.pipeline_stages
for select to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.id = pipeline_stages.job_id
    and public.app_has_permission('recruiting.jobs.read', j.tenant_id)
  )
);

create policy pipeline_stages_write on public.pipeline_stages
for all to authenticated
using (
  exists (
    select 1 from public.jobs j
    where j.id = pipeline_stages.job_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
)
with check (
  exists (
    select 1 from public.jobs j
    where j.id = pipeline_stages.job_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
);

-- Interviews policies
create policy interviews_read on public.interviews
for select to authenticated
using (
  exists (
    select 1 from public.applications a
    join public.jobs j on j.id = a.job_id
    where a.id = interviews.application_id
    and public.app_has_permission('recruiting.jobs.read', j.tenant_id)
  )
);

create policy interviews_write on public.interviews
for all to authenticated
using (
  exists (
    select 1 from public.applications a
    join public.jobs j on j.id = a.job_id
    where a.id = interviews.application_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
)
with check (
  exists (
    select 1 from public.applications a
    join public.jobs j on j.id = a.job_id
    where a.id = interviews.application_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
);

-- Evaluations policies
create policy evaluations_read on public.evaluations
for select to authenticated
using (
  exists (
    select 1 from public.interviews i
    join public.applications a on a.id = i.application_id
    join public.jobs j on j.id = a.job_id
    where i.id = evaluations.interview_id
    and public.app_has_permission('recruiting.jobs.read', j.tenant_id)
  )
);

create policy evaluations_write on public.evaluations
for all to authenticated
using (
  exists (
    select 1 from public.interviews i
    join public.applications a on a.id = i.application_id
    join public.jobs j on j.id = a.job_id
    where i.id = evaluations.interview_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
)
with check (
  exists (
    select 1 from public.interviews i
    join public.applications a on a.id = i.application_id
    join public.jobs j on j.id = a.job_id
    where i.id = evaluations.interview_id
    and public.app_has_permission('recruiting.jobs.write', j.tenant_id)
  )
);

-- Communications policies
create policy communications_read on public.communications
for select to authenticated
using (public.app_has_permission('recruiting.jobs.read', tenant_id));

create policy communications_write on public.communications
for all to authenticated
using (public.app_has_permission('recruiting.jobs.write', tenant_id))
with check (public.app_has_permission('recruiting.jobs.write', tenant_id));

-- Talent pool policies
create policy talent_pool_read on public.talent_pool
for select to authenticated
using (public.app_has_permission('recruiting.candidates.read', tenant_id));

create policy talent_pool_write on public.talent_pool
for all to authenticated
using (public.app_has_permission('recruiting.candidates.write', tenant_id))
with check (public.app_has_permission('recruiting.candidates.write', tenant_id));

-- ==============================================
-- 14. STORAGE BUCKET FOR RESUMES
-- ==============================================

-- Create storage bucket (same pattern as employee-documents)
insert into storage.buckets (id, name, public)
values ('candidate-resumes', 'candidate-resumes', false)
on conflict (id) do nothing;

