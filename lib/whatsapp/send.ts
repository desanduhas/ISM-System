import { createHmac } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatSriLankanPhone } from "@/lib/utils";
import { getWhatsAppConfig } from "./config";
import { buildTemplateComponents } from "./templates";
import type { WhatsAppTemplateName, WhatsAppTemplateParams } from "./templates";

export interface SendWhatsAppOptions<T extends WhatsAppTemplateName> {
  recipientPhone: string;
  recipientId?: string;
  jobId?: string;
  template: T;
  params: WhatsAppTemplateParams[T];
  idempotencyKey: string;
}
export interface SendWhatsAppResult {
  success: boolean;
  mode: "live" | "mock";
  messageId?: string;
  error?: string;
}

function validatePhone(phone: string): string {
  const formatted = formatSriLankanPhone(phone);
  if (!/^\+[1-9]\d{7,14}$/.test(formatted)) {
    throw new Error("Recipient WhatsApp number must be a valid international phone number");
  }
  return formatted;
}

export async function sendWhatsAppNotification<T extends WhatsAppTemplateName>(
  options: SendWhatsAppOptions<T>
): Promise<SendWhatsAppResult> {
  const { recipientPhone, recipientId, jobId, template, params, idempotencyKey } = options;
  const admin = createAdminClient();
  const config = getWhatsAppConfig();
  const e164Phone = validatePhone(recipientPhone);

  const { data: existing } = await admin
    .from("whatsapp_message_logs")
    .select("id, status, wa_message_id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existing && ["SENT", "DELIVERED", "READ"].includes(existing.status)) {
    return {
      success: true,
      mode: existing.wa_message_id?.startsWith("mock_wa_") ? "mock" : "live",
      messageId: existing.wa_message_id || undefined,
    };
  }

  if (!config.live) {
    const mockWaMessageId = `mock_wa_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const { error } = await admin.from("whatsapp_message_logs").upsert({
      job_id: jobId || null,
      recipient_id: recipientId || null,
      recipient_phone: e164Phone,
      template_name: template,
      template_params: params as unknown as Record<string, string>,
      status: "SENT",
      wa_message_id: mockWaMessageId,
      sent_at: new Date().toISOString(),
      error_message: null,
      idempotency_key: idempotencyKey,
    }, { onConflict: "idempotency_key" });

    if (error) {
      return { success: false, mode: "mock", error: `Could not save WhatsApp mock log: ${error.message}` };
    }
    return { success: true, mode: "mock", messageId: mockWaMessageId };
  }

  if (!config.accessToken || !config.phoneNumberId) {
    return { success: false, mode: "live", error: "WhatsApp live configuration is incomplete" };
  }

  const { data: logEntry, error: logError } = await admin
    .from("whatsapp_message_logs")
    .upsert({
      job_id: jobId || null,
      recipient_id: recipientId || null,
      recipient_phone: e164Phone,
      template_name: template,
      template_params: params as unknown as Record<string, string>,
      status: "PENDING",
      idempotency_key: idempotencyKey,
      error_message: null,
    }, { onConflict: "idempotency_key" })
    .select("id, retry_count")
    .single();

  if (logError) {
    return { success: false, mode: "live", error: `Could not create WhatsApp delivery log: ${logError.message}` };
  }

  const url = new URL(`https://graph.facebook.com/${config.graphApiVersion}/${config.phoneNumberId}/messages`);
  if (config.appSecret) {
    url.searchParams.set("appsecret_proof", createHmac("sha256", config.appSecret).update(config.accessToken).digest("hex"));
  }

  const payload = {
    messaging_product: "whatsapp",
    to: e164Phone.slice(1),
    type: "template",
    template: {
      name: template,
      language: { code: config.templateLanguage },
      components: buildTemplateComponents(template, params),
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });

    const data = await response.json() as {
      messages?: Array<{ id: string }>;
      error?: { message?: string; code?: number; fbtrace_id?: string };
    };

    if (!response.ok || data.error) {
      const metaError = data.error;
      const errorMessage = [
        metaError?.message || `Meta API returned HTTP ${response.status}`,
        metaError?.code ? `code ${metaError.code}` : null,
        metaError?.fbtrace_id ? `trace ${metaError.fbtrace_id}` : null,
      ].filter(Boolean).join(" · ");

      await admin.from("whatsapp_message_logs").update({
        status: "FAILED",
        error_message: errorMessage,
        retry_count: (logEntry?.retry_count || 0) + 1,
      }).eq("idempotency_key", idempotencyKey);

      return { success: false, mode: "live", error: errorMessage };
    }

    const waMessageId = data.messages?.[0]?.id;
    if (!waMessageId) {
      throw new Error("Meta API accepted the request without returning a message ID");
    }

    await admin.from("whatsapp_message_logs").update({
      status: "SENT",
      wa_message_id: waMessageId,
      sent_at: new Date().toISOString(),
      error_message: null,
    }).eq("idempotency_key", idempotencyKey);

    return { success: true, mode: "live", messageId: waMessageId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "WhatsApp network request failed";
    await admin.from("whatsapp_message_logs").update({
      status: "FAILED",
      error_message: errorMessage,
      retry_count: (logEntry?.retry_count || 0) + 1,
    }).eq("idempotency_key", idempotencyKey);

    return { success: false, mode: "live", error: errorMessage };
  }
}
