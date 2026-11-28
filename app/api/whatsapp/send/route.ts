import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/get-user";
import { sendWhatsAppNotification } from "@/lib/whatsapp/send";
import { TEMPLATE_DOCS } from "@/lib/whatsapp/templates";
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
  recipientPhone: z.string().min(8).max(24),
  recipientId: z.string().uuid().optional(),
  jobId: z.string().uuid().optional(),
  template: z.enum([
    "job_assigned", "client_visit_reminder", "job_ready_for_review", "revision_requested",
    "work_approved", "invoice_ready", "client_delivery_ready", "payment_verification_required", "job_completed",
  ]),
  params: z.record(z.string().max(1024)),
  idempotencyKey: z.string().min(8).max(256).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const profile = await requireAuth();
    if (!["MANAGEMENT", "MARKETING_CUSTOMER_CARE", "FINANCE"].includes(profile.role)) {
      return NextResponse.json({ error: "Your role cannot send WhatsApp notifications" }, { status: 403 });
    }

    // Rate limit by IP
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const body = await request.json();
    const { recipientPhone, recipientId, jobId, template, params, idempotencyKey } = SendSchema.parse(body);
    const expectedParams = TEMPLATE_DOCS[template].params;
    const suppliedParams = Object.keys(params);
    const missingParams = expectedParams.filter((name) => !(name in params));
    const unknownParams = suppliedParams.filter((name) => !expectedParams.includes(name));
    if (missingParams.length || unknownParams.length) {
      return NextResponse.json({
        error: "Template parameters do not match the approved template",
        missingParams,
        unknownParams,
      }, { status: 400 });
    }

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
      template,
      params: params as never,
      idempotencyKey: key,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
