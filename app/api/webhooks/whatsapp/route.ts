import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createHmac } from "crypto";

// GET: Meta webhook verification challenge
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.META_WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// POST: Delivery and message status updates
export async function POST(request: NextRequest) {
  try {
    // Verify Meta signature
    const signature = request.headers.get("x-hub-signature-256");
    const body = await request.text();

    if (signature && process.env.META_WHATSAPP_ACCESS_TOKEN) {
      // Use app secret for signature verification (stored separately from access token)
      const appSecret = process.env.META_WHATSAPP_APP_SECRET;
      if (appSecret) {
        const expectedSig = "sha256=" + createHmac("sha256", appSecret).update(body).digest("hex");
        if (signature !== expectedSig) {
          return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
      }
    }

    const payload = JSON.parse(body);
    const admin = createAdminClient();

    // Process status updates
    const entries = payload?.entry || [];
    for (const entry of entries) {
      const changes = entry?.changes || [];
      for (const change of changes) {
        const statuses = change?.value?.statuses || [];
        for (const status of statuses) {
          const waMessageId = status.id;
          const newStatus = status.status?.toUpperCase();
          const timestamp = status.timestamp
            ? new Date(parseInt(status.timestamp) * 1000).toISOString()
            : new Date().toISOString();

          if (!waMessageId) continue;

          const updateData: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() };

          if (newStatus === "DELIVERED") updateData.delivered_at = timestamp;
          if (newStatus === "READ") updateData.read_at = timestamp;

          await admin
            .from("whatsapp_message_logs")
            .update(updateData)
            .eq("wa_message_id", waMessageId);
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ received: true }); // Always return 200 to Meta
  }
}
