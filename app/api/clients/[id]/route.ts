import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";

const UpdateClientSchema = z.object({
  company_name: z.string().min(1).max(200).optional(),
  contact_name: z.string().min(1).max(100).optional(),
  phone: z.string().nullable().optional(),
  whatsapp_number: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  billing_address: z.string().nullable().optional(),
  tax_registration: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth();
    const { id } = await params;
    const admin = createAdminClient();

    const { data: client, error } = await admin
      .from("clients")
      .select("*, jobs(id, job_number, title, current_stage, agreed_price)")
      .eq("id", id)
      .single();

    if (error || !client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json({ data: client });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireAuth();
    if (!["MANAGEMENT", "MARKETING_CUSTOMER_CARE"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const validated = UpdateClientSchema.parse(body);
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("clients")
      .select("*")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    const { data: updated, error } = await admin
      .from("clients")
      .update(validated)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;

    await admin.from("audit_logs").insert({
      actor_id: profile.id,
      action: "CLIENT_UPDATED",
      entity_type: "clients",
      entity_id: id,
      old_values: existing,
      new_values: validated,
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireAuth();
    if (profile.role !== "MANAGEMENT") {
      return NextResponse.json(
        { error: "Forbidden: Only Management can delete or deactivate clients" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const admin = createAdminClient();

    // Check if client has linked jobs
    const { count: jobCount } = await admin
      .from("jobs")
      .select("id", { count: "exact", head: true })
      .eq("client_id", id);

    // If client has jobs, soft-deactivate instead of deleting to preserve history
    if (jobCount && jobCount > 0) {
      const { data: deactivated, error } = await admin
        .from("clients")
        .update({ is_active: false })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      await admin.from("audit_logs").insert({
        actor_id: profile.id,
        action: "CLIENT_DEACTIVATED",
        entity_type: "clients",
        entity_id: id,
        new_values: { is_active: false, reason: "Deactivated because client has linked jobs" },
      });

      return NextResponse.json({
        success: true,
        action: "DEACTIVATED",
        message: `Client has ${jobCount} linked jobs. Account was deactivated instead of permanently deleted to preserve records.`,
        data: deactivated,
      });
    }

    // No jobs -> safe to permanently delete
    const { data: existing } = await admin
      .from("clients")
      .select("*")
      .eq("id", id)
      .single();

    const { error: deleteError } = await admin.from("clients").delete().eq("id", id);
    if (deleteError) throw deleteError;

    await admin.from("audit_logs").insert({
      actor_id: profile.id,
      action: "CLIENT_DELETED",
      entity_type: "clients",
      entity_id: id,
      old_values: existing,
    });

    return NextResponse.json({
      success: true,
      action: "DELETED",
      message: "Client deleted successfully.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
