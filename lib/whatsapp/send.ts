import { createAdminClient } from "@/lib/supabase/admin";
import { buildTemplateComponents } from "./templates";
import type { WhatsAppTemplateName, WhatsAppTemplateParams } from "./templates";
import { formatSriLankanPhone } from "@/lib/utils";

export interface SendWhatsAppOptions<T extends WhatsAppTemplateName> {
  recipientPhone: string;
  recipientId?: string;
  jobId?: string;
  template: T;
  params: WhatsAppTemplateParams[T];
  idempotencyKey: string;
}

export async function sendWhatsAppNotification<T extends WhatsAppTemplateName>(
  options: SendWhatsAppOptions<T>
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { recipientPhone, recipientId, jobId, template, params, idempotencyKey } = options;
  const admin = createAdminClient();
  const e164Phone = formatSriLankanPhone(recipientPhone);

  // Check idempotency — prevent duplicate sends
  const { data: existing } = await admin
    .from("whatsapp_message_logs")
    .select("id, status, wa_message_id")
    .eq("idempotency_key", idempotencyKey)
    .single();

  if (existing && existing.status !== "FAILED") {
    return { success: true, messageId: existing.wa_message_id || undefined };
  }

  // If Meta WhatsApp access token is missing, simulate mock/stub sending
  if (!process.env.META_WHATSAPP_ACCESS_TOKEN) {
    console.warn("WhatsApp integration in mock mode: META_WHATSAPP_ACCESS_TOKEN missing");
    const mockWaMessageId = `mock_wa_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    const { error: upsertError } = await admin
      .from("whatsapp_message_logs")
      .upsert({
        job_id: jobId,
        recipient_id: recipientId,
        recipient_phone: e164Phone,
        template_name: template,
        template_params: params as unknown as Record<string, string>,
        status: "SENT",
        wa_message_id: mockWaMessageId,
        sent_at: new Date().toISOString(),
        idempotency_key: idempotencyKey,
      }, { onConflict: "idempotency_key" });

    if (upsertError) {
      console.error("Failed to log mock WhatsApp message:", upsertError);
    }

    return { success: true, messageId: mockWaMessageId };
  }

  // Create log entry
  const { data: logEntry } = await admin
    .from("whatsapp_message_logs")
    .upsert({
      job_id: jobId,
      recipient_id: recipientId,
      recipient_phone: e164Phone,
      template_name: template,
      template_params: params as unknown as Record<string, string>,
      status: "PENDING",
      idempotency_key: idempotencyKey,
    }, { onConflict: "idempotency_key" })
    .select()
    .single();

  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const apiVersion = process.env.META_GRAPH_API_VERSION || "v21.0";
  const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to: e164Phone,
    type: "template",
    template: {
      name: template,
      language: { code: "en" },
      components: buildTemplateComponents(template, params),
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.META_WHATSAPP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json() as { messages?: Array<{ id: string }>; error?: { message: string } };

    if (!response.ok || data.error) {
      const errorMessage = data.error?.message || `HTTP ${response.status}`;
      // Log failure without exposing token
      await admin.from("whatsapp_message_logs").update({
        status: "FAILED",
        error_message: errorMessage,
        retry_count: (logEntry?.retry_count || 0) + 1,
      }).eq("idempotency_key", idempotencyKey);

      return { success: false, error: errorMessage };
    }

    const waMessageId = data.messages?.[0]?.id;

    await admin.from("whatsapp_message_logs").update({
      status: "SENT",
      wa_message_id: waMessageId,
      sent_at: new Date().toISOString(),
      error_message: null,
    }).eq("idempotency_key", idempotencyKey);

    return { success: true, messageId: waMessageId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Network error";
    await admin.from("whatsapp_message_logs").update({
      status: "FAILED",
      error_message: errorMessage,
      retry_count: (logEntry?.retry_count || 0) + 1,
    }).eq("idempotency_key", idempotencyKey);

    return { success: false, error: errorMessage };
  }
}
