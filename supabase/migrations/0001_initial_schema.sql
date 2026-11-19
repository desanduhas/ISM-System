-- Migration: 0001_initial_schema.sql
-- ISM Flow - Initial Database Schema

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- HELPER: updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLE: departments
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id                       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email                    TEXT NOT NULL,
  full_name                TEXT NOT NULL,
  role                     TEXT NOT NULL CHECK (role IN (
                             'MANAGEMENT',
                             'MARKETING_CUSTOMER_CARE',
                             'GRAPHIC_DESIGNER',
                             'CAPTURING',
                             'FINANCE'
                           )),
  department_id            UUID REFERENCES departments(id) ON DELETE SET NULL,
  whatsapp_number          TEXT,
  avatar_url               TEXT,
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  notification_preferences JSONB NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TRIGGER: handle_new_user (create profile on auth.users insert)
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'MARKETING_CUSTOMER_CARE')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- TABLE: clients
-- ============================================================
CREATE TABLE IF NOT EXISTS clients (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_name     TEXT NOT NULL,
  contact_name     TEXT NOT NULL,
  phone            TEXT,
  whatsapp_number  TEXT,
  email            TEXT,
  billing_address  TEXT,
  tax_registration TEXT,
  notes            TEXT,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEQUENCE + TRIGGER: job_number auto-generation
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS job_number_seq START 1000;

CREATE OR REPLACE FUNCTION generate_job_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.job_number IS NULL OR NEW.job_number = '' THEN
    NEW.job_number := 'ISM-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('job_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLE: jobs
-- ============================================================
CREATE TABLE IF NOT EXISTS jobs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_number          TEXT UNIQUE,
  title               TEXT NOT NULL,
  job_type            TEXT NOT NULL CHECK (job_type IN (
                        'Graphic Design',
                        'Photography',
                        'Videography',
                        'Capturing',
                        'Digital Marketing',
                        'Social Media Management',
                        'Content Creation',
                        'Customer Care',
                        'Other'
                      )),
  current_stage       TEXT NOT NULL DEFAULT 'VISIT_SCHEDULED' CHECK (current_stage IN (
                        'VISIT_SCHEDULED',
                        'VISIT_COMPLETED',
                        'BRIEF_CONFIRMED',
                        'IN_PRODUCTION',
                        'READY_FOR_REVIEW',
                        'REVISION_REQUESTED',
                        'APPROVED',
                        'INVOICE_READY',
                        'SENT_TO_CLIENT',
                        'PAYMENT_REPORTED',
                        'PAYMENT_VERIFIED',
                        'COMPLETED',
                        'CANCELLED'
                      )),
  client_id           UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  assigned_to         UUID REFERENCES profiles(id) ON DELETE SET NULL,
  department_id       UUID REFERENCES departments(id) ON DELETE SET NULL,
  visit_date          TIMESTAMPTZ,
  visit_location      TEXT,
  visit_notes         TEXT,
  brief               TEXT,
  deadline            TIMESTAMPTZ,
  agreed_price        NUMERIC(12, 2),
  quotation_notes     TEXT,
  cancellation_reason TEXT,
  cancelled_at        TIMESTAMPTZ,
  created_by          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER jobs_generate_number
  BEFORE INSERT ON jobs
  FOR EACH ROW EXECUTE FUNCTION generate_job_number();

CREATE TRIGGER jobs_updated_at
  BEFORE UPDATE ON jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: job_stage_history
-- ============================================================
CREATE TABLE IF NOT EXISTS job_stage_history (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id      UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  from_stage  TEXT,
  to_stage    TEXT NOT NULL,
  changed_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  reason      TEXT,
  is_override BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: job_assignments
-- ============================================================
CREATE TABLE IF NOT EXISTS job_assignments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  assigned_to  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  role         TEXT,
  assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unassigned_at TIMESTAMPTZ
);

-- ============================================================
-- TABLE: job_comments
-- ============================================================
CREATE TABLE IF NOT EXISTS job_comments (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id      UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER job_comments_updated_at
  BEFORE UPDATE ON job_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: job_attachments
-- ============================================================
CREATE TABLE IF NOT EXISTS job_attachments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  uploaded_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  file_name    TEXT NOT NULL,
  file_type    TEXT NOT NULL CHECK (file_type IN ('draft', 'final', 'raw', 'invoice', 'proof', 'other')),
  storage_path TEXT,
  drive_link   TEXT,
  file_size    BIGINT,
  mime_type    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: job_approvals
-- ============================================================
CREATE TABLE IF NOT EXISTS job_approvals (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id         UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  reviewed_by    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  decision       TEXT NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED')),
  revision_notes TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: quotations
-- ============================================================
CREATE TABLE IF NOT EXISTS quotations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id       UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  agreed_price NUMERIC(12, 2) NOT NULL,
  notes        TEXT,
  valid_until  DATE,
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SEQUENCE + TRIGGER: invoice_number auto-generation
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'INV-' || TO_CHAR(NOW(), 'YYYY') || '-' || LPAD(nextval('invoice_number_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- TABLE: invoices
-- ============================================================
CREATE TABLE IF NOT EXISTS invoices (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_number       TEXT UNIQUE,
  job_id               UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  client_id            UUID NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
  line_items           JSONB NOT NULL DEFAULT '[]',
  subtotal             NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount             NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_rate             NUMERIC(5, 4) NOT NULL DEFAULT 0,
  tax_amount           NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total                NUMERIC(12, 2) NOT NULL DEFAULT 0,
  due_date             DATE,
  payment_instructions TEXT,
  status               TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'ISSUED', 'SENT', 'PAID', 'CANCELLED')),
  pdf_path             TEXT,
  created_by           UUID REFERENCES profiles(id) ON DELETE SET NULL,
  issued_at            TIMESTAMPTZ,
  sent_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER invoices_generate_number
  BEFORE INSERT ON invoices
  FOR EACH ROW EXECUTE FUNCTION generate_invoice_number();

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: payments
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invoice_id         UUID NOT NULL REFERENCES invoices(id) ON DELETE RESTRICT,
  job_id             UUID NOT NULL REFERENCES jobs(id) ON DELETE RESTRICT,
  amount             NUMERIC(12, 2) NOT NULL,
  payment_method     TEXT,
  reference_number   TEXT,
  payment_date       DATE,
  proof_path         TEXT,
  reported_by        UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  reported_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_by        UUID REFERENCES profiles(id) ON DELETE SET NULL,
  verified_at        TIMESTAMPTZ,
  verification_notes TEXT,
  status             TEXT NOT NULL DEFAULT 'REPORTED' CHECK (status IN ('REPORTED', 'VERIFIED', 'REJECTED'))
);

-- ============================================================
-- TABLE: notifications
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  job_id              UUID REFERENCES jobs(id) ON DELETE SET NULL,
  title               TEXT NOT NULL,
  body                TEXT NOT NULL,
  category            TEXT NOT NULL,
  is_read             BOOLEAN NOT NULL DEFAULT FALSE,
  read_at             TIMESTAMPTZ,
  whatsapp_message_id UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: whatsapp_message_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS whatsapp_message_logs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id           UUID REFERENCES jobs(id) ON DELETE SET NULL,
  recipient_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  recipient_phone  TEXT NOT NULL,
  template_name    TEXT NOT NULL,
  template_params  JSONB NOT NULL DEFAULT '{}',
  wa_message_id    TEXT,
  status           TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED')),
  error_message    TEXT,
  retry_count      INT NOT NULL DEFAULT 0,
  idempotency_key  TEXT NOT NULL UNIQUE,
  sent_at          TIMESTAMPTZ,
  delivered_at     TIMESTAMPTZ,
  read_at          TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER whatsapp_message_logs_updated_at
  BEFORE UPDATE ON whatsapp_message_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- TABLE: audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id   UUID,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
