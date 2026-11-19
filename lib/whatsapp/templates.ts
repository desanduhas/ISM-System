export type WhatsAppTemplateName =
  | "job_assigned"
  | "client_visit_reminder"
  | "job_ready_for_review"
  | "revision_requested"
  | "work_approved"
  | "invoice_ready"
  | "client_delivery_ready"
  | "payment_verification_required"
  | "job_completed";

export interface WhatsAppTemplateParams {
  job_assigned: { job_number: string; client_name: string; job_title: string; scheduled_date: string; job_url: string };
  client_visit_reminder: { job_number: string; client_name: string; visit_date: string; visit_location: string };
  job_ready_for_review: { job_number: string; job_title: string; client_name: string; job_url: string };
  revision_requested: { job_number: string; job_title: string; revision_notes: string; job_url: string };
  work_approved: { job_number: string; job_title: string; client_name: string };
  invoice_ready: { job_number: string; job_title: string; client_name: string; job_url: string };
  client_delivery_ready: { client_name: string; job_title: string; company_name: string };
  payment_verification_required: { job_number: string; client_name: string; amount: string; job_url: string };
  job_completed: { job_number: string; job_title: string; client_name: string };
}

// Build the Meta API component structure for each template
export function buildTemplateComponents<T extends WhatsAppTemplateName>(
  template: T,
  params: WhatsAppTemplateParams[T]
): Array<Record<string, unknown>> {
  const values = Object.values(params).map(v => ({
    type: "text",
    text: String(v),
  }));

  return [
    {
      type: "body",
      parameters: values,
    },
  ];
}

// Template documentation for WhatsApp Manager setup
export const TEMPLATE_DOCS: Record<WhatsAppTemplateName, { body: string; params: string[] }> = {
  job_assigned: {
    body: "New job assigned: {{1}}\nClient: {{2}}\nTask: {{3}}\nDate: {{4}}\nOpen job: {{5}}",
    params: ["job_number", "client_name", "job_title", "scheduled_date", "job_url"],
  },
  client_visit_reminder: {
    body: "Visit reminder: {{1}}\nClient: {{2}}\nDate & Time: {{3}}\nLocation: {{4}}",
    params: ["job_number", "client_name", "visit_date", "visit_location"],
  },
  job_ready_for_review: {
    body: "Review required: {{1}}\nJob: {{2}}\nClient: {{3}}\nOpen for review: {{4}}",
    params: ["job_number", "job_title", "client_name", "job_url"],
  },
  revision_requested: {
    body: "Revision requested: {{1}}\nJob: {{2}}\nNotes: {{3}}\nOpen job: {{4}}",
    params: ["job_number", "job_title", "revision_notes", "job_url"],
  },
  work_approved: {
    body: "Great news! Your work for {{1}} has been approved.\nJob: {{2}}\nClient: {{3}}",
    params: ["job_number", "job_title", "client_name"],
  },
  invoice_ready: {
    body: "Invoice ready to send: {{1}}\nJob: {{2}}\nClient: {{3}}\nOpen job: {{4}}",
    params: ["job_number", "job_title", "client_name", "job_url"],
  },
  client_delivery_ready: {
    body: "Dear {{1}}, your project '{{2}}' from {{3}} is ready. We will share the final files shortly.",
    params: ["client_name", "job_title", "company_name"],
  },
  payment_verification_required: {
    body: "Payment verification needed: {{1}}\nClient: {{2}}\nAmount: {{3}}\nOpen job: {{4}}",
    params: ["job_number", "client_name", "amount", "job_url"],
  },
  job_completed: {
    body: "Job completed: {{1}} - {{2}}\nClient: {{3}}\nAll tasks have been closed successfully.",
    params: ["job_number", "job_title", "client_name"],
  },
};
