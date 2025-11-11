-- Add role_permissions for people_ops after enum value exists (separate tx)

insert into public.role_permissions (role, permission_key) values
  ('people_ops','employees.read'),
  ('people_ops','employees.write'),
  ('people_ops','employees.documents.read'),
  ('people_ops','employees.documents.write'),
  ('people_ops','employees.fields.manage'),
  ('people_ops','workflows.read'),
  ('people_ops','goals.read'),
  ('people_ops','goals.write'),
  ('people_ops','check_ins.read'),
  ('people_ops','calendar.read')
on conflict do nothing;


