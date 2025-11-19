-- tasks & checklists enhancements
-- adds task_type to workflow_run_steps for UI/API filtering

alter table public.workflow_run_steps
  add column if not exists task_type text not null default 'general'
    check (task_type in ('general','document','form'));

create index if not exists workflow_run_steps_task_type_idx
  on public.workflow_run_steps (task_type);
