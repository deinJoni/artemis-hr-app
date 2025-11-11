-- Document Expiry Notifications
-- This migration adds tracking for document expiry notifications

-- ==============================================
-- 1. DOCUMENT EXPIRY NOTIFICATIONS TABLE
-- ==============================================

CREATE TABLE IF NOT EXISTS public.document_expiry_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.employee_documents(id) ON DELETE CASCADE,
  notification_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notification_type TEXT NOT NULL CHECK (notification_type IN ('expiring_soon', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes for document expiry notifications
CREATE INDEX IF NOT EXISTS document_expiry_notifications_document_idx ON public.document_expiry_notifications (document_id);
CREATE INDEX IF NOT EXISTS document_expiry_notifications_type_idx ON public.document_expiry_notifications (notification_type, created_at DESC);

-- ==============================================
-- 2. ROW LEVEL SECURITY
-- ==============================================

ALTER TABLE public.document_expiry_notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read notifications for documents in their tenant
CREATE POLICY document_expiry_notifications_read
ON public.document_expiry_notifications
FOR SELECT
USING (
  document_id IN (
    SELECT id FROM public.employee_documents
    WHERE tenant_id IN (
      SELECT tenant_id FROM public.memberships
      WHERE user_id = public.app_current_user_id()
    )
  )
);

-- Policy: System can create notifications (via service role)
CREATE POLICY document_expiry_notifications_write
ON public.document_expiry_notifications
FOR INSERT
WITH CHECK (true);

