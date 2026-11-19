import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";

const UpdateInvoiceSchema = z.object({
  status: z.enum(["DRAFT", "ISSUED", "SENT", "PAID", "CANCELLED"]).optional(),
  due_date: z.string().optional(),
  payment_instructions: z.string().optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireAuth();
    if (!["MANAGEMENT", "FINANCE", "MARKETING_CUSTOMER_CARE"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { id } = await context.params;
    const admin = createAdminClient();

    const { data, error } = await admin
      .from("invoices")
      .select("*, client:clients(*), job:jobs(*)")
      .eq("id", id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireAuth();
    if (!["FINANCE", "MANAGEMENT"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden: Only Finance or Management can modify invoices" }, { status: 403 });
    }
    const { id } = await context.params;
    const body = await request.json();
    const validated = UpdateInvoiceSchema.parse(body);
    const admin = createAdminClient();

    const updateData: Record<string, unknown> = {
      ...validated,
      updated_at: new Date().toISOString(),
    };

    if (validated.status === "ISSUED") {
      updateData.issued_at = new Date().toISOString();
    } else if (validated.status === "SENT") {
      updateData.sent_at = new Date().toISOString();
    }

    const { data: invoice, error } = await admin
      .from("invoices")
      .update(updateData)
      .eq("id", id)
      .select("*, client:clients(*), job:jobs(*)")
      .single();

    if (error) throw error;

    await admin.from("audit_logs").insert({
      actor_id: profile.id,
      action: "INVOICE_UPDATED",
      entity_type: "invoices",
      entity_id: id,
      new_values: validated,
    });

    return NextResponse.json({ data: invoice });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
