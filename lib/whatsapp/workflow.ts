import { createAdminClient } from "@/lib/supabase/admin";
import type { JobStage } from "@/lib/types";
import { generateIdempotencyKey } from "@/lib/utils";
import { getWhatsAppConfig } from "./config";
import { sendWhatsAppNotification } from "./send";
import type { SendWhatsAppOptions } from "./send";
import type { WhatsAppTemplateName } from "./templates";

type AdminClient = ReturnType<typeof createAdminClient>;

interface WorkflowProfile {
  id: string;
  whatsapp_number: string | null;
  notification_preferences?: Record<string, boolean> | null;
}

interface WorkflowClient {
  contact_name?: string | null;
  company_name?: string | null;
  whatsapp_number?: string | null;
  phone?: string | null;
}

export interface WhatsAppWorkflowJob {
  id: string;
  job_number: string;
  title: string;
  assigned_to?: string | null;
  created_by?: string | null;
  visit_date?: string | null;
  visit_location?: string | null;
  deadline?: string | null;
  agreed_price?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
  client?: WorkflowClient | WorkflowClient[] | null;
}

interface StageContext {
  eventId?: string;
  revisionNotes?: string;
  amount?: number;
}

function wantsWhatsApp(profile: WorkflowProfile, template: WhatsAppTemplateName): boolean {
  const preferences = profile.notification_preferences || {};
  return Boolean(profile.whatsapp_number) && preferences.whatsapp !== false && preferences[template] !== false;
}

function displayDate(value?: string | null): string {
  if (!value) return "Not scheduled";
  return new Intl.DateTimeFormat("en-LK", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Colombo",
  }).format(new Date(value));
}

function jobClient(job: WhatsAppWorkflowJob): WorkflowClient {
  if (Array.isArray(job.client)) return job.client[0] || {};
  return job.client || {};
}

function jobUrl(jobId: string): string {
  return `${getWhatsAppConfig().appUrl}/jobs/${jobId}`;
}

async function getProfile(admin: AdminClient, id?: string | null): Promise<WorkflowProfile | null> {
  if (!id) return null;
  const { data } = await admin
    .from("profiles")
    .select("id, whatsapp_number, notification_preferences")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  return data as WorkflowProfile | null;
}

async function getProfilesByRole(
  admin: AdminClient,
  role: "MANAGEMENT" | "FINANCE" | "MARKETING_CUSTOMER_CARE"
): Promise<WorkflowProfile[]> {
  const { data } = await admin
    .from("profiles")
    .select("id, whatsapp_number, notification_preferences")
    .eq("role", role)
    .eq("is_active", true);
  return (data || []) as WorkflowProfile[];
}

async function sendSafely<T extends WhatsAppTemplateName>(options: SendWhatsAppOptions<T>): Promise<void> {
  try {
    const result = await sendWhatsAppNotification(options);
    if (!result.success) console.error(`WhatsApp ${options.template} failed:`, result.error);
  } catch (error) {
    console.error(`WhatsApp ${options.template} failed:`, error instanceof Error ? error.message : error);
  }
}

function eventKey(job: WhatsAppWorkflowJob, template: WhatsAppTemplateName, recipient: string, eventId?: string): string {
  return generateIdempotencyKey("workflow", job.id, template, recipient, eventId || job.updated_at || job.created_at || "initial");
}

export async function notifyJobCreatedViaWhatsApp(job: WhatsAppWorkflowJob): Promise<void> {
  const admin = createAdminClient();
  const client = jobClient(job);
  const recipient = await getProfile(admin, job.assigned_to);
  if (!recipient || !wantsWhatsApp(recipient, "job_assigned") || !recipient.whatsapp_number) return;

  await sendSafely({
    recipientPhone: recipient.whatsapp_number,
    recipientId: recipient.id,
    jobId: job.id,
    template: "job_assigned",
    params: {
      job_number: job.job_number,
      client_name: client.company_name || client.contact_name || "Client",
      job_title: job.title,
      scheduled_date: displayDate(job.visit_date || job.deadline),
      job_url: jobUrl(job.id),
    },
    idempotencyKey: eventKey(job, "job_assigned", recipient.id, job.created_at || undefined),
  });
}

export async function notifyStageTransitionViaWhatsApp(
  job: WhatsAppWorkflowJob,
  toStage: JobStage,
  context: StageContext = {}
): Promise<void> {
  const admin = createAdminClient();
  const client = jobClient(job);
  const clientName = client.company_name || client.contact_name || "Client";
  const url = jobUrl(job.id);
  const sends: Array<Promise<void>> = [];

  if (toStage === "READY_FOR_REVIEW") {
    const managers = await getProfilesByRole(admin, "MANAGEMENT");
    for (const recipient of managers) {
      if (!wantsWhatsApp(recipient, "job_ready_for_review") || !recipient.whatsapp_number) continue;
      sends.push(sendSafely({
        recipientPhone: recipient.whatsapp_number,
        recipientId: recipient.id,
        jobId: job.id,
        template: "job_ready_for_review",
        params: { job_number: job.job_number, job_title: job.title, client_name: clientName, job_url: url },
        idempotencyKey: eventKey(job, "job_ready_for_review", recipient.id, context.eventId),
      }));
    }
  }

  if (toStage === "REVISION_REQUESTED") {
    const recipient = await getProfile(admin, job.assigned_to);
    if (recipient && wantsWhatsApp(recipient, "revision_requested") && recipient.whatsapp_number) {
      sends.push(sendSafely({
        recipientPhone: recipient.whatsapp_number,
        recipientId: recipient.id,
        jobId: job.id,
        template: "revision_requested",
        params: {
          job_number: job.job_number,
          job_title: job.title,
          revision_notes: context.revisionNotes || "Please revise and resubmit.",
          job_url: url,
        },
        idempotencyKey: eventKey(job, "revision_requested", recipient.id, context.eventId),
      }));
    }
  }

  if (toStage === "APPROVED") {
    const recipient = await getProfile(admin, job.assigned_to);
    if (recipient && wantsWhatsApp(recipient, "work_approved") && recipient.whatsapp_number) {
      sends.push(sendSafely({
        recipientPhone: recipient.whatsapp_number,
        recipientId: recipient.id,
        jobId: job.id,
        template: "work_approved",
        params: { job_number: job.job_number, job_title: job.title, client_name: clientName },
        idempotencyKey: eventKey(job, "work_approved", recipient.id, context.eventId),
      }));
    }
  }

  if (toStage === "INVOICE_READY") {
    const marketingTeam = await getProfilesByRole(admin, "MARKETING_CUSTOMER_CARE");
    for (const recipient of marketingTeam) {
      if (!wantsWhatsApp(recipient, "invoice_ready") || !recipient.whatsapp_number) continue;
      sends.push(sendSafely({
        recipientPhone: recipient.whatsapp_number,
        recipientId: recipient.id,
        jobId: job.id,
        template: "invoice_ready",
        params: { job_number: job.job_number, job_title: job.title, client_name: clientName, job_url: url },
        idempotencyKey: eventKey(job, "invoice_ready", recipient.id, context.eventId),
      }));
    }
  }

  if (toStage === "SENT_TO_CLIENT") {
    const phone = client.whatsapp_number || client.phone;
    if (phone) {
      sends.push(sendSafely({
        recipientPhone: phone,
        jobId: job.id,
        template: "client_delivery_ready",
        params: {
          client_name: client.contact_name || clientName,
          job_title: job.title,
          company_name: "I Shop Marketing",
        },
        idempotencyKey: eventKey(job, "client_delivery_ready", phone, context.eventId),
      }));
    }
  }

  if (toStage === "PAYMENT_REPORTED") {
    const financeTeam = await getProfilesByRole(admin, "FINANCE");
    for (const recipient of financeTeam) {
      if (!wantsWhatsApp(recipient, "payment_verification_required") || !recipient.whatsapp_number) continue;
      sends.push(sendSafely({
        recipientPhone: recipient.whatsapp_number,
        recipientId: recipient.id,
        jobId: job.id,
        template: "payment_verification_required",
        params: {
          job_number: job.job_number,
          client_name: clientName,
          amount: `LKR ${new Intl.NumberFormat("en-LK").format(context.amount || job.agreed_price || 0)}`,
          job_url: url,
        },
        idempotencyKey: eventKey(job, "payment_verification_required", recipient.id, context.eventId),
      }));
    }
  }

  if (toStage === "COMPLETED") {
    const managers = await getProfilesByRole(admin, "MANAGEMENT");
    for (const recipient of managers) {
      if (!wantsWhatsApp(recipient, "job_completed") || !recipient.whatsapp_number) continue;
      sends.push(sendSafely({
        recipientPhone: recipient.whatsapp_number,
        recipientId: recipient.id,
        jobId: job.id,
        template: "job_completed",
        params: { job_number: job.job_number, job_title: job.title, client_name: clientName },
        idempotencyKey: eventKey(job, "job_completed", recipient.id, context.eventId),
      }));
    }
  }

  await Promise.all(sends);
}

