import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";

const AddCommentSchema = z.object({
  content: z.string().trim().min(1, "Comment content cannot be empty").max(2000, "Comment too long"),
  is_internal: z.boolean().default(false),
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

    // Role access check: non-management, non-finance should only see their assigned job
    if (
      profile.role !== "MANAGEMENT" &&
      profile.role !== "FINANCE" &&
      profile.role !== "MARKETING_CUSTOMER_CARE" &&
      job.assigned_to !== profile.id
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: comments, error: commentsErr } = await admin
      .from("job_comments")
      .select(`
        id,
        job_id,
        author_id,
        content,
        is_internal,
        created_at,
        updated_at,
        author:profiles!job_comments_author_id_fkey(id, full_name, role, avatar_url)
      `)
      .eq("job_id", jobId)
      .order("created_at", { ascending: true });

    if (commentsErr) {
      throw commentsErr;
    }

    return NextResponse.json({ data: comments || [] });
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
    const validated = AddCommentSchema.parse(body);

    const { data: comment, error: insertErr } = await admin
      .from("job_comments")
      .insert({
        job_id: jobId,
        author_id: profile.id,
        content: validated.content,
        is_internal: validated.is_internal,
      })
      .select(`
        id,
        job_id,
        author_id,
        content,
        is_internal,
        created_at,
        updated_at,
        author:profiles!job_comments_author_id_fkey(id, full_name, role, avatar_url)
      `)
      .single();

    if (insertErr) {
      throw insertErr;
    }

    // Log to audit_logs
    await admin.from("audit_logs").insert({
      actor_id: profile.id,
      action: "COMMENT_ADDED",
      entity_type: "job_comments",
      entity_id: comment.id,
      new_values: { job_id: jobId, is_internal: validated.is_internal },
    });

    return NextResponse.json({ data: comment }, { status: 201 });
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
