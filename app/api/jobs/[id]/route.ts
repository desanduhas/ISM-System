import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profile = await requireAuth();
    const { id } = await params;
    const admin = createAdminClient();

    const { data: job, error } = await admin
      .from("jobs")
      .select(`
        *,
        client:clients(*),
        assigned_profile:profiles!jobs_assigned_to_fkey(id, full_name, role, whatsapp_number),
        department:departments(id, name),
        job_stage_history(*, changed_by_profile:profiles!job_stage_history_changed_by_fkey(id, full_name)),
        job_comments(*, author:profiles!job_comments_author_id_fkey(id, full_name, role)),
        job_attachments(*, uploader:profiles!job_attachments_uploaded_by_fkey(id, full_name)),
        job_approvals(*, reviewer:profiles!job_approvals_reviewed_by_fkey(id, full_name)),
        invoices(id, invoice_number, status, total, pdf_path, created_at),
        payments(*)
      `)
      .eq("id", id)
      .single();

    if (error) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    // Access control check
    const canView =
      profile.role === "MANAGEMENT" ||
      job.assigned_to === profile.id ||
      job.created_by === profile.id ||
      (profile.role === "FINANCE" && ["APPROVED","INVOICE_READY","SENT_TO_CLIENT","PAYMENT_REPORTED","PAYMENT_VERIFIED","COMPLETED"].includes(job.current_stage));

    if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    return NextResponse.json({ data: job });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const UpdateJobSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  job_type: z.enum(["Graphic Design","Photography","Videography","Capturing","Digital Marketing","Social Media Management","Content Creation","Customer Care","Other"]).optional(),
  assigned_to: z.string().uuid().nullable().optional(),
  department_id: z.string().uuid().nullable().optional(),
  visit_date: z.string().datetime().nullable().optional(),
  visit_location: z.string().nullable().optional(),
  visit_notes: z.string().nullable().optional(),
  brief: z.string().nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
  agreed_price: z.number().positive().nullable().optional(),
  quotation_notes: z.string().nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profile = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const admin = createAdminClient();

    // Verify job exists and check access
    const { data: existing } = await admin.from("jobs").select("*").eq("id", id).single();
    if (!existing) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const isManagement = profile.role === "MANAGEMENT";
    const isAssigned = existing.assigned_to === profile.id;

    if (!isManagement && !isAssigned) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Non-management can only update limited fields
    let validated: Record<string, unknown>;
    if (isManagement) {
      validated = UpdateJobSchema.parse(body);
    } else {
      const LimitedSchema = z.object({
        visit_notes: z.string().nullable().optional(),
        brief: z.string().nullable().optional(),
      });
      validated = LimitedSchema.parse(body);
    }

    const { data: updated, error } = await admin
      .from("jobs")
      .update(validated)
      .eq("id", id)
      .select(`*, client:clients(*), assigned_profile:profiles!jobs_assigned_to_fkey(id, full_name, role)`)
      .single();

    if (error) throw error;

    // Audit log
    await admin.from("audit_logs").insert({
      actor_id: profile.id,
      action: "JOB_UPDATED",
      entity_type: "jobs",
      entity_id: id,
      old_values: existing,
      new_values: validated,
      ip_address: request.headers.get("x-forwarded-for"),
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
