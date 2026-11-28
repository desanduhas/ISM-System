import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getWhatsAppConfig } from "@/lib/whatsapp/config";
import { verifyMetaWebhookSignature, webhookErrorMessage } from "@/lib/whatsapp/webhook";

export async function GET(request: NextRequest) {
  const config = getWhatsAppConfig();
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (!config.verifyToken) {
    return NextResponse.json({ error: "WhatsApp webhook verification is not configured" }, { status: 503 });
  }

  if (mode === "subscribe" && token === config.verifyToken && challenge) {
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
export async function POST(request: NextRequest) {
  const config = getWhatsAppConfig();
  const signature = request.headers.get("x-hub-signature-256");
  const rawBody = await request.text();

  if (!config.appSecret) {
    return NextResponse.json({ error: "WhatsApp webhook signature verification is not configured" }, { status: 503 });
  }
  if (!verifyMetaWebhookSignature(rawBody, signature, config.appSecret)) {
    return NextResponse.json({ error: "Invalid Meta webhook signature" }, { status: 401 });
  }

  try {
    const payload = JSON.parse(rawBody) as {
      object?: string;
      entry?: Array<{
        changes?: Array<{
          value?: {
            statuses?: Array<{
              id?: string;
              status?: string;
              timestamp?: string;
              errors?: Array<{ title?: string; message?: string; code?: number }>;
            }>;
          };
        }>;
      }>;
    };

    if (payload.object !== "whatsapp_business_account") {
      return NextResponse.json({ received: true, ignored: true });
    }

    const admin = createAdminClient();
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        for (const status of change.value?.statuses || []) {
          if (!status.id) continue;
          const nextStatus = status.status?.toUpperCase();
          if (!["SENT", "DELIVERED", "READ", "FAILED"].includes(nextStatus || "")) continue;

          const eventTime = status.timestamp
            ? new Date(Number.parseInt(status.timestamp, 10) * 1000).toISOString()
            : new Date().toISOString();
          const update: Record<string, unknown> = {
            status: nextStatus,
            updated_at: new Date().toISOString(),
          };

          if (nextStatus === "DELIVERED") update.delivered_at = eventTime;
          if (nextStatus === "READ") update.read_at = eventTime;
          if (nextStatus === "FAILED") update.error_message = webhookErrorMessage(status) || "Meta reported delivery failure";
          if (nextStatus !== "FAILED") update.error_message = null;

          const { error } = await admin
            .from("whatsapp_message_logs")
            .update(update)
            .eq("wa_message_id", status.id);
          if (error) console.error("Could not update WhatsApp delivery status:", error.message);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Could not process WhatsApp webhook:", error instanceof Error ? error.message : error);
    return NextResponse.json({ received: true });
  }
}
