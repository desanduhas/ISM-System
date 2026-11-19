-- Migration: 0003_indexes.sql
-- ISM Flow - Performance Indexes

-- jobs indexes
CREATE INDEX IF NOT EXISTS idx_jobs_current_stage   ON jobs(current_stage);
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_to     ON jobs(assigned_to);
CREATE INDEX IF NOT EXISTS idx_jobs_client_id       ON jobs(client_id);
CREATE INDEX IF NOT EXISTS idx_jobs_department_id   ON jobs(department_id);
CREATE INDEX IF NOT EXISTS idx_jobs_visit_date      ON jobs(visit_date);
CREATE INDEX IF NOT EXISTS idx_jobs_deadline        ON jobs(deadline);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at      ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_job_number      ON jobs(job_number);

-- job_stage_history indexes
CREATE INDEX IF NOT EXISTS idx_job_stage_history_job_id     ON job_stage_history(job_id);
CREATE INDEX IF NOT EXISTS idx_job_stage_history_created_at ON job_stage_history(created_at DESC);

-- notifications indexes
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_id ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read      ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at   ON notifications(created_at DESC);

-- invoices indexes
CREATE INDEX IF NOT EXISTS idx_invoices_job_id         ON invoices(job_id);
CREATE INDEX IF NOT EXISTS idx_invoices_client_id      ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status         ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_number ON invoices(invoice_number);

-- payments indexes
CREATE INDEX IF NOT EXISTS idx_payments_invoice_id ON payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_status     ON payments(status);

-- whatsapp_message_logs indexes
CREATE INDEX IF NOT EXISTS idx_wamsg_job_id          ON whatsapp_message_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_wamsg_recipient_id    ON whatsapp_message_logs(recipient_id);
CREATE INDEX IF NOT EXISTS idx_wamsg_status          ON whatsapp_message_logs(status);
CREATE INDEX IF NOT EXISTS idx_wamsg_idempotency_key ON whatsapp_message_logs(idempotency_key);

-- audit_logs indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id          ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity            ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at        ON audit_logs(created_at DESC);

-- clients indexes
CREATE INDEX IF NOT EXISTS idx_clients_company_name ON clients(company_name);
CREATE INDEX IF NOT EXISTS idx_clients_is_active    ON clients(is_active);

-- profiles indexes
CREATE INDEX IF NOT EXISTS idx_profiles_role      ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);
