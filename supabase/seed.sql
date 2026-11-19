-- supabase/seed.sql
-- ISM Flow - Sample Seed Data
-- WARNING: This file contains FICTIONAL data for development only.

-- ============================================================
-- DEPARTMENTS (5 sample departments)
-- ============================================================
INSERT INTO departments (id, name, description) VALUES
  ('11111111-1111-1111-1111-111111111101', 'Management',             'Executive and operations management'),
  ('11111111-1111-1111-1111-111111111102', 'Marketing & Customer Care', 'Client relations and marketing operations'),
  ('11111111-1111-1111-1111-111111111103', 'Graphic Design',         'Visual design and branding'),
  ('11111111-1111-1111-1111-111111111104', 'Capturing',              'Photography and videography'),
  ('11111111-1111-1111-1111-111111111105', 'Finance',                'Invoicing, payments and financial reporting')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- AUTH USERS NOTE
-- ============================================================
-- Auth users cannot be created via SQL seed.
-- To create users, run:  npm run seed
-- Or use the Supabase Dashboard → Authentication → Users.
-- The handle_new_user trigger will auto-create a profile row.

-- ============================================================
-- SAMPLE CLIENTS (fictional Sri Lankan businesses)
-- ============================================================
INSERT INTO clients (id, company_name, contact_name, phone, whatsapp_number, email, billing_address, notes, is_active) VALUES
  (
    '22222222-2222-2222-2222-222222222201',
    'Perera & Sons Holdings (Pvt) Ltd',
    'Nimal Perera',
    '+94700000001',
    '+94700000001',
    'nimal@pereraholdings.example.lk',
    'No. 42, Galle Road, Colombo 03, Sri Lanka',
    'Long-term client. Prefers WhatsApp communication.',
    TRUE
  ),
  (
    '22222222-2222-2222-2222-222222222202',
    'Senanayake Digital Solutions',
    'Priya Senanayake',
    '+94700000002',
    '+94700000002',
    'priya@senanayakedigital.example.lk',
    '78 Kandy Road, Kelaniya, Sri Lanka',
    'New client onboarded 2024. Social media focus.',
    TRUE
  )
ON CONFLICT (id) DO NOTHING;
