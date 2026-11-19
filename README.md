# ISM Flow — Agency Operations Platform

Production-ready, responsive web application for Sri Lankan marketing agencies. Manages client jobs end-to-end: from initial visit scheduling to production, management approval, invoicing, client delivery, payment reporting, and financial reconciliation.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router, Server Components & Server Actions)
- **Language**: TypeScript 5.7 (Strict mode enabled)
- **Styling**: Tailwind CSS & Lucide Icons
- **Database & Auth**: Supabase PostgreSQL with Row Level Security (RLS) & Supabase SSR
- **Invoicing**: `@react-pdf/renderer` for server-side PDF invoice generation
- **Messaging**: Meta WhatsApp Cloud API (Template-based business notifications with simulated mock fallback)
- **Validation**: Zod & React Hook Form
- **Testing**: Jest & Testing Library (57 unit & workflow test cases)

---

## User Roles & Permission Matrix

| Role | Permissions & Responsibilities |
|---|---|
| **MANAGEMENT** | Up to 4 admin users. Full agency control: create/cancel/reassign jobs, override workflow stages (with mandatory reason), approve/reject creative work, manage employees & departments, view all jobs, invoices, payments, and audit logs. |
| **MARKETING_CUSTOMER_CARE** | Receive visit assignments, record visit notes & client requirements, set quotation & deadlines, send final work & invoices to clients, record client feedback, report received payments to Finance. |
| **GRAPHIC_DESIGNER** | View client briefs, update production progress, attach drafts/files or Google Drive links, submit completed work for Management approval. Cannot approve own work. |
| **CAPTURING** | Photography & videography assignments. View shooting location & schedule, upload raw & final assets, submit work for Management review. |
| **FINANCE** | Receive notifications when work is approved, generate and download PDF invoices, verify or reject reported payments with notes, close verified financial records. |

---

## 12-Stage Job Workflow

1. `VISIT_SCHEDULED`: Management creates job & calendar event; assigned MCC staff receives notification.
2. `VISIT_COMPLETED`: MCC records visit notes, client requirements, and contact details.
3. `BRIEF_CONFIRMED`: Job type, deadline, price, and production department assigned; production staff notified.
4. `IN_PRODUCTION`: Designer/Capturing updates progress and uploads drafts or links.
5. `READY_FOR_REVIEW`: Creative staff submits completed work for Management review.
6. `REVISION_REQUESTED`: Management requests revision with notes; job returns to production.
7. `APPROVED`: Management approves final product; Finance notified to prepare invoice.
8. `INVOICE_READY`: Finance generates unique PDF invoice; MCC notified to deliver.
9. `SENT_TO_CLIENT`: MCC sends approved product & invoice to client; records delivery notes.
10. `PAYMENT_REPORTED`: MCC records client payment claim with proof reference.
11. `PAYMENT_VERIFIED`: Finance verifies transaction reference, amount, and date.
12. `COMPLETED`: Job closed; completion notifications dispatched to relevant staff.
- `CANCELLED`: Management can cancel a job at any stage with a mandatory cancellation reason.

---

## Local Setup

### 1. Prerequisites
- **Node.js**: `v20+` or `v22+`
- **npm** or **pnpm**
- A free **Supabase** account ([supabase.com](https://supabase.com))

### 2. Installation
```bash
git clone <your-repo>
cd ism-flow
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Fill in the required values:
```env
# Supabase Configuration (Dashboard -> Settings -> API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# Meta WhatsApp Cloud API (Optional - system gracefully logs in mock mode if unset)
META_WHATSAPP_ACCESS_TOKEN=EAAB...
META_WHATSAPP_PHONE_NUMBER_ID=100...
META_WHATSAPP_WABA_ID=100...
META_WHATSAPP_VERIFY_TOKEN=your_custom_secure_verify_token
META_GRAPH_API_VERSION=v21.0

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Database Migrations & Supabase Setup

Run the migrations in order using either the **Supabase Dashboard SQL Editor** or the **Supabase CLI**:

1. `supabase/migrations/0001_initial_schema.sql`: Creates all 15 tables (`profiles`, `departments`, `clients`, `jobs`, `job_stage_history`, `job_assignments`, `job_comments`, `job_attachments`, `job_approvals`, `quotations`, `invoices`, `payments`, `notifications`, `whatsapp_message_logs`, `audit_logs`), auto-number sequences, and triggers.
2. `supabase/migrations/0002_rls_policies.sql`: Enables Row Level Security on all tables with granular role-based policies.
3. `supabase/migrations/0003_indexes.sql`: Creates performance indexes for frequent query fields.

### Storage Buckets Setup
In Supabase Dashboard -> **Storage**, create these 3 buckets:
- `attachments` (Private)
- `invoices` (Private)
- `proofs` (Private)

### Development Seed Data
To populate fictional development users and sample clients:
```bash
# Set SUPABASE_SERVICE_ROLE_KEY in .env.local, then run:
npm run seed
```

This creates standard test accounts:
- **Management 1**: `manager1@example.com` / `Change-Me-123!`
- **Management 2**: `manager2@example.com` / `Change-Me-123!`
- **Marketing & Customer Care**: `mcc1@example.com` / `Change-Me-123!`
- **Graphic Designer**: `designer1@example.com` / `Change-Me-123!`
- **Capturing**: `capture1@example.com` / `Change-Me-123!`
- **Finance**: `finance1@example.com` / `Change-Me-123!`

---

## Meta Developer App & WhatsApp Setup

> **Note**: Live Meta keys are optional during development. When `META_WHATSAPP_ACCESS_TOKEN` is unset, ISM Flow operates in **Graceful Mock Mode**, logging message templates and delivery timestamps into `whatsapp_message_logs` without failing workflows.

### 1. Developer App Setup
1. Go to [developers.facebook.com](https://developers.facebook.com) and create a **Business App**.
2. Add the **WhatsApp** product.
3. In **API Setup**, retrieve your:
   - **Temporary Access Token** (or create a permanent System User token)
   - **Phone Number ID**
   - **WhatsApp Business Account ID (WABA ID)**

### 2. WhatsApp Message Templates
In WhatsApp Manager -> Account Tools -> **Message Templates**, create the following 9 utility/marketing templates in language `en`:

1. `job_assigned`:
   ```
   New job assigned: {{1}}
   Client: {{2}}
   Task: {{3}}
   Date: {{4}}
   Open job: {{5}}
   ```
2. `client_visit_reminder`:
   ```
   Visit reminder: {{1}}
   Client: {{2}}
   Date & Time: {{3}}
   Location: {{4}}
   ```
3. `job_ready_for_review`:
   ```
   Review required: {{1}}
   Job: {{2}}
   Client: {{3}}
   Open for review: {{4}}
   ```
4. `revision_requested`:
   ```
   Revision requested: {{1}}
   Job: {{2}}
   Notes: {{3}}
   Open job: {{4}}
   ```
5. `work_approved`:
   ```
   Great news! Your work for {{1}} has been approved.
   Job: {{2}}
   Client: {{3}}
   ```
6. `invoice_ready`:
   ```
   Invoice ready to send: {{1}}
   Job: {{2}}
   Client: {{3}}
   Open job: {{4}}
   ```
7. `client_delivery_ready`:
   ```
   Dear {{1}}, your project '{{2}}' from {{3}} is ready. We will share the final files shortly.
   ```
8. `payment_verification_required`:
   ```
   Payment verification needed: {{1}}
   Client: {{2}}
   Amount: {{3}}
   Open job: {{4}}
   ```
9. `job_completed`:
   ```
   Job completed: {{1}} - {{2}}
   Client: {{3}}
   All tasks have been closed successfully.
   ```

### 3. Webhook Configuration
1. In Meta Developer Console -> WhatsApp -> Configuration -> **Webhook**:
   - **Callback URL**: `https://<your-domain>/api/webhooks/whatsapp`
   - **Verify Token**: Must match `META_WHATSAPP_VERIFY_TOKEN` in your environment.
2. Under Webhook Fields, subscribe to **`messages`**.

---

## Testing & Quality Assurance

Run the automated test suite covering state transitions, role security, phone formatting, invoice math, and webhooks:

```bash
# Run Jest tests
npm test

# Run TypeScript type check
npm run type-check

# Run production build
npm run build
```

---

## Deployment Instructions (Vercel)

1. Push your repository to GitHub / GitLab.
2. In [Vercel Dashboard](https://vercel.com), import your repository.
3. Configure the **Environment Variables** in Vercel Project Settings:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_APP_URL` (e.g. `https://ism-flow.vercel.app`)
   - (Optional) Meta WhatsApp credentials.
4. Deploy. Next.js App Router will generate optimized server and client bundles.

---

## Security Architecture

- **No Hardcoded Secrets**: Zero API tokens or passwords committed in version control.
- **Server-Side Role Guard**: Every API route and Server Action independently verifies user permissions with `requireAuth()` and `canTransition()`.
- **Database RLS Policies**: Row Level Security enforced on PostgreSQL tables preventing unauthorized direct data access.
- **Webhook Authentication**: Meta webhooks verified via HMAC SHA-256 signature when `META_WHATSAPP_APP_SECRET` is configured.
- **Rate Limiting**: WhatsApp dispatch endpoint rate-limited to prevent abuse.
- **Immutable Audit Log**: Every job creation, update, stage transition, client change, and invoice generation is recorded with actor ID, IP address, and timestamp.
- **Phone Normalization**: Sri Lankan phone numbers automatically formatted to E.164 (`+94...`).

---

## Known Limitations

- **Meta Template Approval**: New WhatsApp templates require Meta approval before production dispatch (typically 1-5 minutes).
- **Offline Mode**: Operations require network connectivity to Supabase.
- **Client Delivery**: Client WhatsApp delivery is initiated via template; ongoing two-way client conversations outside notifications occur via standard WhatsApp business channels.
