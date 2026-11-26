import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";

const ReportPaymentSchema = z.object({
  invoice_id: z.string().uuid(),
  job_id: z.string().uuid(),
  amount: z.number().positive(),
  payment_method: z.string().optional(),
  reference_number: z.string().optional(),
  payment_date: z.string().optional(),
});

const VerifyPaymentSchema = z.object({
  payment_id: z.string().uuid(),
  status: z.enum(["VERIFIED", "REJECTED"]),
  verification_notes: z.string().optional(),
});

export async function GET() {
  try {
    const profile = await requireAuth();
    if (!["MANAGEMENT", "FINANCE"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const admin = createAdminClient();

    const { data, count, error } = await admin
      .from("payments")
      .select("*, invoice:invoices(invoice_number, total), job:jobs(job_number, title)", { count: "exact" })
      .order("reported_at", { ascending: false });

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
    const body = await request.json();
    const admin = createAdminClient();

    if (body.action === "verify") {
      // Finance verifies payment
      if (!["FINANCE", "MANAGEMENT"].includes(profile.role)) {
        return NextResponse.json({ error: "Forbidden: Only Finance can verify payments" }, { status: 403 });
      }

      const { payment_id, status, verification_notes } = VerifyPaymentSchema.parse(body);

      const { data: payment, error } = await admin
        .from("payments")
        .update({
          status,
          verified_by: profile.id,
          verified_at: new Date().toISOString(),
          verification_notes: verification_notes || null,
        })
        .eq("id", payment_id)
        .select()
        .single();

      if (error) throw error;

      // If verified, advance job to PAYMENT_VERIFIED
      if (status === "VERIFIED") {
        await admin.from("jobs").update({ current_stage: "PAYMENT_VERIFIED" }).eq("id", payment.job_id);
        await admin.from("job_stage_history").insert({
          job_id: payment.job_id,
          from_stage: "PAYMENT_REPORTED",
          to_stage: "PAYMENT_VERIFIED",
          changed_by: profile.id,
        });
      }

      return NextResponse.json({ data: payment });
    } else {
      // MCC reports payment
      if (!["MARKETING_CUSTOMER_CARE", "MANAGEMENT"].includes(profile.role)) {
        return NextResponse.json({ error: "Forbidden: Only Marketing team can report payments" }, { status: 403 });
      }

      const validated = ReportPaymentSchema.parse(body);

      const { data: newPayment, error } = await admin
        .from("payments")
        .insert({
          ...validated,
          reported_by: profile.id,
          status: "REPORTED",
        })
        .select()
        .single();

      if (error) throw error;

      // Advance job to PAYMENT_REPORTED
      await admin.from("jobs").update({ current_stage: "PAYMENT_REPORTED" }).eq("id", validated.job_id);
      await admin.from("job_stage_history").insert({
        job_id: validated.job_id,
        from_stage: "SENT_TO_CLIENT",
        to_stage: "PAYMENT_REPORTED",
        changed_by: profile.id,
      });

      return NextResponse.json({ data: newPayment }, { status: 201 });
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
