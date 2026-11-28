import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyStageTransitionViaWhatsApp } from "@/lib/whatsapp/workflow";

const LineItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit_price: z.number().nonnegative(),
  amount: z.number().nonnegative(),
});

const CreateInvoiceSchema = z.object({
  job_id: z.string().uuid(),
  client_id: z.string().uuid(),
  line_items: z.array(LineItemSchema).min(1),
  discount: z.number().nonnegative().default(0),
  tax_rate: z.number().nonnegative().max(100).default(0),
  due_date: z.string().optional(),
  payment_instructions: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const profile = await requireAuth();
    if (!["MANAGEMENT", "FINANCE"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const admin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");

    let query = admin
      .from("invoices")
      .select("*, client:clients(id, company_name, contact_name), job:jobs(id, job_number, title)", { count: "exact" })
      .order("created_at", { ascending: false });

    if (status) query = query.eq("status", status);

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data, count });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireAuth();
    if (!["FINANCE", "MANAGEMENT"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden: Only Finance can create invoices" }, { status: 403 });
    }

    const body = await request.json();
    const validated = CreateInvoiceSchema.parse(body);
    const admin = createAdminClient();

    // Check job is in APPROVED stage
    const { data: job } = await admin
      .from("jobs")
      .select("id, job_number, title, current_stage, assigned_to, created_by, agreed_price, created_at, updated_at, client:clients(company_name, contact_name, phone, whatsapp_number)")
      .eq("id", validated.job_id)
      .single();
    if (!job || !["APPROVED", "INVOICE_READY"].includes(job.current_stage)) {
      return NextResponse.json({ error: "Job must be APPROVED before creating an invoice" }, { status: 400 });
    }

    // Calculate totals
    const subtotal = validated.line_items.reduce((sum, item) => sum + item.amount, 0);
    const taxAmount = subtotal * (validated.tax_rate / 100);
    const total = subtotal - validated.discount + taxAmount;

    const { data: invoice, error } = await admin
      .from("invoices")
      .insert({
        invoice_number: "", // Set by trigger
        job_id: validated.job_id,
        client_id: validated.client_id,
        line_items: validated.line_items,
        subtotal,
        discount: validated.discount,
        tax_rate: validated.tax_rate,
        tax_amount: taxAmount,
        total,
        due_date: validated.due_date || null,
        payment_instructions: validated.payment_instructions || null,
        status: "DRAFT",
        created_by: profile.id,
      })
      .select("*, client:clients(*), job:jobs(id, job_number, title)")
      .single();

    if (error) throw error;

    // Auto-advance job to INVOICE_READY
    if (job.current_stage === "APPROVED") {
      await admin.from("jobs").update({ current_stage: "INVOICE_READY" }).eq("id", validated.job_id);
      await admin.from("job_stage_history").insert({
        job_id: validated.job_id,
        from_stage: "APPROVED",
        to_stage: "INVOICE_READY",
        changed_by: profile.id,
        reason: `Invoice ${invoice.invoice_number} created`,
      });
    }

    await admin.from("audit_logs").insert({
      actor_id: profile.id,
      action: "INVOICE_CREATED",
      entity_type: "invoices",
      entity_id: invoice.id,
      new_values: { invoice_number: invoice.invoice_number, total },
    });

    await notifyStageTransitionViaWhatsApp(job, "INVOICE_READY", { eventId: invoice.id });

    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
