import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";

const RecordAttachmentSchema = z.object({
  file_name: z.string().trim().min(1, "File name is required").max(255),
  file_type: z.enum(["draft", "final", "raw", "invoice", "proof", "other"]),
  storage_path: z.string().nullable().optional(),
  drive_link: z.string().url().nullable().optional().or(z.literal("")),
  file_size: z.number().int().nonnegative().nullable().optional(),
  mime_type: z.string().nullable().optional(),
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireAuth();
    const { id: jobId } = await context.params;

    const admin = createAdminClient();

    // Check job exists
    const { data: job, error: jobErr } = await admin
      .from("jobs")
      .select("id, assigned_to")
      .eq("id", jobId)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Role access check
    if (
      profile.role !== "MANAGEMENT" &&
      profile.role !== "FINANCE" &&
      profile.role !== "MARKETING_CUSTOMER_CARE" &&
      job.assigned_to !== profile.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: attachments, error: attachErr } = await admin
      .from("job_attachments")
      .select(`
        id,
        job_id,
        uploaded_by,
        file_name,
        file_type,
        storage_path,
        drive_link,
        file_size,
        mime_type,
        created_at,
        uploader:profiles!job_attachments_uploaded_by_fkey(id, full_name, role)
      `)
      .eq("job_id", jobId)
      .order("created_at", { ascending: false });

    if (attachErr) {
      throw attachErr;
    }

    return NextResponse.json({ data: attachments || [] });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (message === "UNAUTHORIZED" || message === "ACCOUNT_DISABLED") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireAuth();
    const { id: jobId } = await context.params;

    const admin = createAdminClient();

    // Check job exists
    const { data: job, error: jobErr } = await admin
      .from("jobs")
      .select("id, assigned_to")
      .eq("id", jobId)
      .single();

    if (jobErr || !job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const body = await request.json();
    const validated = RecordAttachmentSchema.parse(body);

    const driveLink = validated.drive_link ? validated.drive_link : null;
    const storagePath = validated.storage_path ? validated.storage_path : null;

    const { data: attachment, error: insertErr } = await admin
      .from("job_attachments")
      .insert({
        job_id: jobId,
        uploaded_by: profile.id,
        file_name: validated.file_name,
        file_type: validated.file_type,
        storage_path: storagePath,
        drive_link: driveLink,
        file_size: validated.file_size ?? null,
        mime_type: validated.mime_type ?? null,
      })
      .select(`
        id,
        job_id,
        uploaded_by,
        file_name,
        file_type,
        storage_path,
        drive_link,
        file_size,
        mime_type,
        created_at,
        uploader:profiles!job_attachments_uploaded_by_fkey(id, full_name, role)
      `)
      .single();

    if (insertErr) {
      throw insertErr;
    }

    // Log to audit_logs
    await admin.from("audit_logs").insert({
      actor_id: profile.id,
      action: "ATTACHMENT_UPLOADED",
      entity_type: "job_attachments",
      entity_id: attachment.id,
      new_values: {
        job_id: jobId,
        file_name: validated.file_name,
        file_type: validated.file_type,
      },
    });

    return NextResponse.json({ data: attachment }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Internal error";
    if (message === "UNAUTHORIZED" || message === "ACCOUNT_DISABLED") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
