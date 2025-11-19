-- Extend employee document categories for supplemental agreements, warnings, and references
alter table public.employee_documents
  drop constraint if exists employee_documents_category_check;

alter table public.employee_documents
  add constraint employee_documents_category_check check (
    category in (
      'contract',
      'supplemental_agreement',
      'disciplinary_warning',
      'reference_letter',
      'certification',
      'id_document',
      'performance',
      'medical',
      'other'
    )
  );
