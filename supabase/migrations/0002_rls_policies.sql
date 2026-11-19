-- Migration: 0002_rls_policies.sql
-- ISM Flow - Row Level Security Policies

-- ============================================================
-- HELPER SECURITY DEFINER FUNCTIONS
-- ============================================================

-- Returns the role of the currently authenticated user
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Returns TRUE if the current user has the MANAGEMENT role
CREATE OR REPLACE FUNCTION is_management()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'MANAGEMENT'
  );
$$;

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE departments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients                ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_stage_history      ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_assignments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_comments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_attachments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_approvals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices               ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_message_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs             ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PROFILES POLICIES
-- ============================================================
-- Any authenticated user can view active profiles
CREATE POLICY "profiles_select_active"
  ON profiles FOR SELECT
  TO authenticated
  USING (is_active = TRUE);

-- Users can update their own profile
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Management can update any profile
CREATE POLICY "profiles_update_management"
  ON profiles FOR UPDATE
  TO authenticated
  USING (is_management())
  WITH CHECK (is_management());

-- INSERT handled by service role via trigger only
-- (no INSERT policy for authenticated role)

-- ============================================================
-- DEPARTMENTS POLICIES
-- ============================================================
CREATE POLICY "departments_select_all"
  ON departments FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "departments_all_management"
  ON departments FOR ALL
  TO authenticated
  USING (is_management())
  WITH CHECK (is_management());

-- ============================================================
-- CLIENTS POLICIES
-- ============================================================
CREATE POLICY "clients_select_all"
  ON clients FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "clients_insert_mcc_or_mgmt"
  ON clients FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('MANAGEMENT', 'MARKETING_CUSTOMER_CARE'));

CREATE POLICY "clients_update_mcc_or_mgmt"
  ON clients FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('MANAGEMENT', 'MARKETING_CUSTOMER_CARE'))
  WITH CHECK (get_my_role() IN ('MANAGEMENT', 'MARKETING_CUSTOMER_CARE'));

CREATE POLICY "clients_delete_management"
  ON clients FOR DELETE
  TO authenticated
  USING (is_management());

-- ============================================================
-- JOBS POLICIES
-- ============================================================

-- MANAGEMENT sees all jobs
CREATE POLICY "jobs_select_management"
  ON jobs FOR SELECT
  TO authenticated
  USING (is_management());

-- Assigned user sees their jobs
CREATE POLICY "jobs_select_assigned"
  ON jobs FOR SELECT
  TO authenticated
  USING (assigned_to = auth.uid());

-- FINANCE sees jobs in financial stages
CREATE POLICY "jobs_select_finance"
  ON jobs FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'FINANCE'
    AND current_stage IN (
      'APPROVED', 'INVOICE_READY', 'SENT_TO_CLIENT',
      'PAYMENT_REPORTED', 'PAYMENT_VERIFIED', 'COMPLETED'
    )
  );

-- MARKETING_CUSTOMER_CARE sees jobs they created or are assigned to
CREATE POLICY "jobs_select_mcc"
  ON jobs FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'MARKETING_CUSTOMER_CARE'
    AND (created_by = auth.uid() OR assigned_to = auth.uid())
  );

-- Only MANAGEMENT can create jobs
CREATE POLICY "jobs_insert_management"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK (is_management());

-- MANAGEMENT or assigned user can update jobs
CREATE POLICY "jobs_update_management_or_assigned"
  ON jobs FOR UPDATE
  TO authenticated
  USING (is_management() OR assigned_to = auth.uid())
  WITH CHECK (is_management() OR assigned_to = auth.uid());

-- ============================================================
-- JOB_STAGE_HISTORY POLICIES
-- ============================================================
CREATE POLICY "job_stage_history_select"
  ON job_stage_history FOR SELECT
  TO authenticated
  USING (
    is_management()
    OR EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_stage_history.job_id
        AND j.assigned_to = auth.uid()
    )
  );

-- INSERT open (service role performs inserts)
CREATE POLICY "job_stage_history_insert_all"
  ON job_stage_history FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

-- ============================================================
-- JOB_ASSIGNMENTS POLICIES
-- ============================================================
CREATE POLICY "job_assignments_select_all"
  ON job_assignments FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "job_assignments_all_management"
  ON job_assignments FOR ALL
  TO authenticated
  USING (is_management())
  WITH CHECK (is_management());

-- ============================================================
-- JOB_COMMENTS POLICIES
-- ============================================================
CREATE POLICY "job_comments_select"
  ON job_comments FOR SELECT
  TO authenticated
  USING (
    is_management()
    OR author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_comments.job_id
        AND j.assigned_to = auth.uid()
    )
  );

CREATE POLICY "job_comments_insert"
  ON job_comments FOR INSERT
  TO authenticated
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "job_comments_update_own"
  ON job_comments FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

-- ============================================================
-- JOB_ATTACHMENTS POLICIES
-- ============================================================
CREATE POLICY "job_attachments_select"
  ON job_attachments FOR SELECT
  TO authenticated
  USING (
    is_management()
    OR EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_attachments.job_id
        AND j.assigned_to = auth.uid()
    )
  );

CREATE POLICY "job_attachments_insert"
  ON job_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (
      is_management()
      OR EXISTS (
        SELECT 1 FROM jobs j
        WHERE j.id = job_attachments.job_id
          AND j.assigned_to = auth.uid()
      )
    )
  );

-- ============================================================
-- JOB_APPROVALS POLICIES
-- ============================================================
CREATE POLICY "job_approvals_select"
  ON job_approvals FOR SELECT
  TO authenticated
  USING (
    is_management()
    OR EXISTS (
      SELECT 1 FROM jobs j
      WHERE j.id = job_approvals.job_id
        AND j.assigned_to = auth.uid()
    )
  );

CREATE POLICY "job_approvals_insert_management"
  ON job_approvals FOR INSERT
  TO authenticated
  WITH CHECK (is_management());

-- ============================================================
-- QUOTATIONS POLICIES
-- ============================================================
CREATE POLICY "quotations_select"
  ON quotations FOR SELECT
  TO authenticated
  USING (get_my_role() IN ('MANAGEMENT', 'MARKETING_CUSTOMER_CARE'));

CREATE POLICY "quotations_insert"
  ON quotations FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('MANAGEMENT', 'MARKETING_CUSTOMER_CARE'));

-- ============================================================
-- INVOICES POLICIES
-- ============================================================
CREATE POLICY "invoices_select"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    is_management()
    OR get_my_role() = 'FINANCE'
    OR (
      get_my_role() = 'MARKETING_CUSTOMER_CARE'
      AND EXISTS (
        SELECT 1 FROM jobs j
        WHERE j.id = invoices.job_id
          AND (j.created_by = auth.uid() OR j.assigned_to = auth.uid())
      )
    )
  );

CREATE POLICY "invoices_insert"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('FINANCE', 'MANAGEMENT'));

CREATE POLICY "invoices_update"
  ON invoices FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('FINANCE', 'MANAGEMENT'))
  WITH CHECK (get_my_role() IN ('FINANCE', 'MANAGEMENT'));

-- ============================================================
-- PAYMENTS POLICIES
-- ============================================================
CREATE POLICY "payments_select"
  ON payments FOR SELECT
  TO authenticated
  USING (get_my_role() IN ('FINANCE', 'MANAGEMENT'));

CREATE POLICY "payments_insert"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (get_my_role() IN ('MARKETING_CUSTOMER_CARE', 'MANAGEMENT'));

CREATE POLICY "payments_update"
  ON payments FOR UPDATE
  TO authenticated
  USING (get_my_role() IN ('FINANCE', 'MANAGEMENT'))
  WITH CHECK (get_my_role() IN ('FINANCE', 'MANAGEMENT'));

-- ============================================================
-- NOTIFICATIONS POLICIES
-- ============================================================
CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  TO authenticated
  USING (recipient_id = auth.uid());

-- INSERT open (service role sends notifications)
CREATE POLICY "notifications_insert_all"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- ============================================================
-- WHATSAPP_MESSAGE_LOGS POLICIES
-- ============================================================
CREATE POLICY "wamsg_select_management"
  ON whatsapp_message_logs FOR SELECT
  TO authenticated
  USING (is_management());

-- ALL open for service role operations
CREATE POLICY "wamsg_all_service"
  ON whatsapp_message_logs FOR ALL
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- ============================================================
-- AUDIT_LOGS POLICIES
-- ============================================================
CREATE POLICY "audit_logs_select_management"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (is_management());

-- INSERT open for service role
CREATE POLICY "audit_logs_insert_all"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);
