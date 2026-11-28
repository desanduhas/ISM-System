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
export const TEMPLATE_DOCS: Record<WhatsAppTemplateName, { body: string; params: string[]; examples: string[] }> = {
  job_assigned: {
    body: "A new job has been assigned in ISM Flow.\n\nJob reference: {{1}}\nClient: {{2}}\nTask: {{3}}\nScheduled date: {{4}}\nJob link: {{5}}\n\nPlease review the assignment details.",
    params: ["job_number", "client_name", "job_title", "scheduled_date", "job_url"],
    examples: ["ISM-2026-1001", "ABC Company", "Social Media Design", "28 Nov 2026, 10:00 AM", "https://ismlk.com/jobs/example"],
  },
  client_visit_reminder: {
    body: "Client visit reminder for job {{1}}.\nClient: {{2}}\nDate and time: {{3}}\nLocation: {{4}}\n\nPlease review the visit details in ISM Flow.",
    params: ["job_number", "client_name", "visit_date", "visit_location"],
    examples: ["ISM-2026-1001", "ABC Company", "30 Nov 2026, 9:30 AM", "Colombo 03"],
  },
  job_ready_for_review: {
    body: "Job {{1}} is ready for review.\nTask: {{2}}\nClient: {{3}}\nReview link: {{4}}\n\nPlease review the submitted work.",
    params: ["job_number", "job_title", "client_name", "job_url"],
    examples: ["ISM-2026-1001", "Social Media Design", "ABC Company", "https://ismlk.com/jobs/example"],
  },
  revision_requested: {
    body: "A revision was requested for job {{1}}.\nTask: {{2}}\nRevision notes: {{3}}\nJob link: {{4}}\n\nPlease review the feedback and update the work.",
    params: ["job_number", "job_title", "revision_notes", "job_url"],
    examples: ["ISM-2026-1001", "Social Media Design", "Update the headline and brand colour", "https://ismlk.com/jobs/example"],
  },
  work_approved: {
    body: "Work has been approved for job {{1}}.\nTask: {{2}}\nClient: {{3}}\n\nNo further changes are required at this stage.",
    params: ["job_number", "job_title", "client_name"],
    examples: ["ISM-2026-1001", "Social Media Design", "ABC Company"],
  },
  invoice_ready: {
    body: "An invoice is ready for job {{1}}.\nTask: {{2}}\nClient: {{3}}\nJob link: {{4}}\n\nPlease review and send the invoice.",
    params: ["job_number", "job_title", "client_name", "job_url"],
    examples: ["ISM-2026-1001", "Social Media Design", "ABC Company", "https://ismlk.com/jobs/example"],
  },
  client_delivery_ready: {
    body: "Hello {{1}}, your project {{2}} from {{3}} is ready.\n\nWe will share the final files shortly.",
    params: ["client_name", "job_title", "company_name"],
    examples: ["Alex", "Social Media Design", "I SHOP MARKETING (PVT) Ltd"],
  },
  payment_verification_required: {
    body: "Payment verification is required for job {{1}}.\nClient: {{2}}\nAmount: {{3}}\nJob link: {{4}}\n\nPlease verify the payment details.",
    params: ["job_number", "client_name", "amount", "job_url"],
    examples: ["ISM-2026-1001", "ABC Company", "LKR 25,000.00", "https://ismlk.com/jobs/example"],
  },
  job_completed: {
    body: "Job {{1}} is complete.\nTask: {{2}}\nClient: {{3}}\n\nAll tasks have been closed successfully.",
    params: ["job_number", "job_title", "client_name"],
    examples: ["ISM-2026-1001", "Social Media Design", "ABC Company"],
  },
};

export function buildTemplateRegistrationPayload(
  name: WhatsAppTemplateName,
  language = "en_US"
) {
  const definition = TEMPLATE_DOCS[name];

  return {
    name,
    language,
    category: "UTILITY",
    allow_category_change: true,
    parameter_format: "POSITIONAL",
    components: [
      {
        type: "BODY",
        text: definition.body,
        example: { body_text: [definition.examples] },
      },
    ],
  };
}
