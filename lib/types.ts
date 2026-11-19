export type UserRole =
  | "MANAGEMENT"
  | "MARKETING_CUSTOMER_CARE"
  | "GRAPHIC_DESIGNER"
  | "CAPTURING"
  | "FINANCE";

export type JobStage =
  | "VISIT_SCHEDULED"
  | "VISIT_COMPLETED"
  | "BRIEF_CONFIRMED"
  | "IN_PRODUCTION"
  | "READY_FOR_REVIEW"
  | "REVISION_REQUESTED"
  | "APPROVED"
  | "INVOICE_READY"
  | "SENT_TO_CLIENT"
  | "PAYMENT_REPORTED"
  | "PAYMENT_VERIFIED"
  | "COMPLETED"
  | "CANCELLED";

export type JobType =
  | "Graphic Design"
  | "Photography"
  | "Videography"
  | "Capturing"
  | "Digital Marketing"
  | "Social Media Management"
  | "Content Creation"
  | "Customer Care"
  | "Other";

export type InvoiceStatus = "DRAFT" | "ISSUED" | "SENT" | "PAID" | "CANCELLED";
export type PaymentStatus = "REPORTED" | "VERIFIED" | "REJECTED";
export type WhatsAppMessageStatus = "PENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED";
export type ApprovalDecision = "APPROVED" | "REJECTED";
export type AttachmentType = "draft" | "final" | "raw" | "invoice" | "proof" | "other";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  department_id: string | null;
  whatsapp_number: string | null;
  avatar_url: string | null;
  is_active: boolean;
  notification_preferences: Record<string, boolean>;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  company_name: string;
  contact_name: string;
  phone: string | null;
  whatsapp_number: string | null;
  email: string | null;
  billing_address: string | null;
  tax_registration: string | null;
  notes: string | null;
  created_by: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: string;
  job_number: string;
  title: string;
  job_type: JobType;
  current_stage: JobStage;
  client_id: string;
  assigned_to: string | null;
  department_id: string | null;
  visit_date: string | null;
  visit_location: string | null;
  visit_notes: string | null;
  brief: string | null;
  deadline: string | null;
  agreed_price: number | null;
  quotation_notes: string | null;
  cancellation_reason: string | null;
  cancelled_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  assigned_profile?: Profile;
  department?: Department;
}

export interface JobStageHistory {
  id: string;
  job_id: string;
  from_stage: JobStage | null;
  to_stage: JobStage;
  changed_by: string | null;
  reason: string | null;
  is_override: boolean;
  created_at: string;
  changed_by_profile?: Profile;
}

export interface JobComment {
  id: string;
  job_id: string;
  author_id: string;
  content: string;
  is_internal: boolean;
  created_at: string;
  updated_at: string;
  author?: Profile;
}

export interface JobAttachment {
  id: string;
  job_id: string;
  uploaded_by: string | null;
  file_name: string;
  file_type: AttachmentType;
  storage_path: string | null;
  drive_link: string | null;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
  uploader?: Profile;
}

export interface JobApproval {
  id: string;
  job_id: string;
  reviewed_by: string;
  decision: ApprovalDecision;
  revision_notes: string | null;
  created_at: string;
  reviewer?: Profile;
}

export interface InvoiceLineItem {
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  job_id: string;
  client_id: string;
  line_items: InvoiceLineItem[];
  subtotal: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  due_date: string | null;
  payment_instructions: string | null;
  status: InvoiceStatus;
  pdf_path: string | null;
  created_by: string | null;
  issued_at: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  job?: Job;
}

export interface Payment {
  id: string;
  invoice_id: string;
  job_id: string;
  amount: number;
  payment_method: string | null;
  reference_number: string | null;
  payment_date: string | null;
  proof_path: string | null;
  reported_by: string;
  reported_at: string;
  verified_by: string | null;
  verified_at: string | null;
  verification_notes: string | null;
  status: PaymentStatus;
}

export interface Notification {
  id: string;
  recipient_id: string;
  job_id: string | null;
  title: string;
  body: string;
  category: string;
  is_read: boolean;
  read_at: string | null;
  whatsapp_message_id: string | null;
  created_at: string;
  job?: Job;
}

export interface WhatsAppMessageLog {
  id: string;
  job_id: string | null;
  recipient_id: string | null;
  recipient_phone: string;
  template_name: string;
  template_params: Record<string, string>;
  wa_message_id: string | null;
  status: WhatsAppMessageStatus;
  error_message: string | null;
  retry_count: number;
  idempotency_key: string;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// API response types
export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
}
