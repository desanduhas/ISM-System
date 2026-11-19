import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/get-user";
import { sendWhatsAppNotification } from "@/lib/whatsapp/send";
import { generateIdempotencyKey } from "@/lib/utils";

// Simple in-memory rate limiter
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + 60_000 });
    return true;
  }
  if (entry.count >= 10) return false;
  entry.count++;
  return true;
}

const SendSchema = z.object({
  recipientPhone: z.string().min(7),
  recipientId: z.string().uuid().optional(),
  jobId: z.string().uuid().optional(),
  template: z.string(),
  params: z.record(z.string()),
  idempotencyKey: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const profile = await requireAuth();

    // Rate limit by IP
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await request.json();
    const { recipientPhone, recipientId, jobId, template, params, idempotencyKey } = SendSchema.parse(body);

    const key = idempotencyKey || generateIdempotencyKey(
      "manual",
      profile.id,
      template,
      recipientPhone,
      Date.now().toString()
    );

    const result = await sendWhatsAppNotification({
      recipientPhone,
      recipientId,
      jobId,
      template: template as Parameters<typeof sendWhatsAppNotification>[0]["template"],
      params: params as Parameters<typeof sendWhatsAppNotification>[0]["params"],
      idempotencyKey: key,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
