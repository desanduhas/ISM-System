import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { canTransition } from "@/lib/auth/role-guard";
import type { JobStage, UserRole } from "@/lib/types";

const StageTransitionSchema = z.object({
  to_stage: z.enum([
    "VISIT_SCHEDULED","VISIT_COMPLETED","BRIEF_CONFIRMED","IN_PRODUCTION",
    "READY_FOR_REVIEW","REVISION_REQUESTED","APPROVED","INVOICE_READY",
    "SENT_TO_CLIENT","PAYMENT_REPORTED","PAYMENT_VERIFIED","COMPLETED","CANCELLED"
  ]),
  reason: z.string().optional(),
  is_override: z.boolean().default(false),
  revision_notes: z.string().optional(),
  // For APPROVED / REVISION_REQUESTED
  approval_decision: z.enum(["APPROVED","REJECTED"]).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const profile = await requireAuth();
    const { id } = await params;
    const body = await request.json();
    const { to_stage, reason, is_override, revision_notes } = StageTransitionSchema.parse(body);
    const admin = createAdminClient();

    // Get current job
    const { data: job, error: jobError } = await admin
      .from("jobs")
      .select("*, client:clients(*), assigned_profile:profiles!jobs_assigned_to_fkey(id, full_name, whatsapp_number)")
      .eq("id", id)
      .single();

    if (jobError || !job) return NextResponse.json({ error: "Job not found" }, { status: 404 });

    const fromStage = job.current_stage as JobStage;

    // Check if override
    if (is_override) {
      if (profile.role !== "MANAGEMENT") {
        return NextResponse.json({ error: "Only management can override stages" }, { status: 403 });
      }
      if (!reason) {
        return NextResponse.json({ error: "Override reason is required" }, { status: 400 });
      }
    } else {
      // Normal transition — check permission
      if (!canTransition(profile.role as UserRole, fromStage, to_stage as JobStage)) {
        return NextResponse.json({
          error: `Your role (${profile.role}) cannot transition from ${fromStage} to ${to_stage}`,
        }, { status: 403 });
      }
    }

    // Cancellation requires reason
    if (to_stage === "CANCELLED" && !reason) {
      return NextResponse.json({ error: "Cancellation reason is required" }, { status: 400 });
    }

    // Revision requires notes
    if (to_stage === "REVISION_REQUESTED" && !revision_notes) {
      return NextResponse.json({ error: "Revision notes are required when requesting revision" }, { status: 400 });
    }

    // Update job stage
    const updateData: Record<string, unknown> = { current_stage: to_stage };
    if (to_stage === "CANCELLED") {
      updateData.cancellation_reason = reason;
      updateData.cancelled_at = new Date().toISOString();
    }

    const { data: updated, error: updateError } = await admin
      .from("jobs")
      .update(updateData)
      .eq("id", id)
      .select(`*, client:clients(*), assigned_profile:profiles!jobs_assigned_to_fkey(id, full_name, role)`)
      .single();

    if (updateError) throw updateError;

    // Record stage history
    await admin.from("job_stage_history").insert({
      job_id: id,
      from_stage: fromStage,
      to_stage,
      changed_by: profile.id,
      reason: reason || revision_notes || null,
      is_override,
    });

    // Record approval if applicable
    if (to_stage === "APPROVED" || to_stage === "REVISION_REQUESTED") {
      await admin.from("job_approvals").insert({
        job_id: id,
        reviewed_by: profile.id,
        decision: to_stage === "APPROVED" ? "APPROVED" : "REJECTED",
        revision_notes: revision_notes || null,
      });
    }

    // Audit log
    await admin.from("audit_logs").insert({
      actor_id: profile.id,
      action: "JOB_STAGE_CHANGED",
      entity_type: "jobs",
      entity_id: id,
      old_values: { stage: fromStage },
      new_values: { stage: to_stage, reason, is_override },
      ip_address: request.headers.get("x-forwarded-for"),
    });

    // Create in-app notifications
    await createStageNotifications(admin, job, fromStage, to_stage as JobStage, profile.id, revision_notes);

    return NextResponse.json({ data: updated });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function createStageNotifications(
  admin: ReturnType<typeof import("@/lib/supabase/admin").createAdminClient>,
  job: Record<string, unknown>,
  fromStage: JobStage,
  toStage: JobStage,
  actorId: string,
  revisionNotes?: string
) {
  const notifications: Array<{
    recipient_id: string;
    job_id: string;
    title: string;
    body: string;
    category: string;
  }> = [];

  const jobTitle = job.title as string;
  const jobId = job.id as string;
  const jobNumber = job.job_number as string;

  // Determine who to notify based on new stage
  const getManagers = async () => {
    const { data } = await admin.from("profiles").select("id").eq("role", "MANAGEMENT").eq("is_active", true);
    return (data || []).map(p => p.id);
  };

  const getFinanceTeam = async () => {
    const { data } = await admin.from("profiles").select("id").eq("role", "FINANCE").eq("is_active", true);
    return (data || []).map(p => p.id);
  };

  if (toStage === "READY_FOR_REVIEW") {
    const managers = await getManagers();
    managers.forEach(managerId => {
      if (managerId !== actorId) {
        notifications.push({
          recipient_id: managerId,
          job_id: jobId,
          title: "Work ready for review",
          body: `${jobNumber}: "${jobTitle}" has been submitted for management approval.`,
          category: "REVIEW_REQUIRED",
        });
      }
    });
  } else if (toStage === "APPROVED") {
    const finance = await getFinanceTeam();
    finance.forEach(financeId => {
      notifications.push({
        recipient_id: financeId,
        job_id: jobId,
        title: "Job approved — prepare invoice",
        body: `${jobNumber}: "${jobTitle}" has been approved. Please create the invoice.`,
        category: "INVOICE_REQUIRED",
      });
    });
    // Also notify assigned employee
    if (job.assigned_to && job.assigned_to !== actorId) {
      notifications.push({
        recipient_id: job.assigned_to as string,
        job_id: jobId,
        title: "Your work has been approved!",
        body: `${jobNumber}: "${jobTitle}" was approved by management.`,
        category: "WORK_APPROVED",
      });
    }
  } else if (toStage === "REVISION_REQUESTED") {
    if (job.assigned_to && job.assigned_to !== actorId) {
      notifications.push({
        recipient_id: job.assigned_to as string,
        job_id: jobId,
        title: "Revision requested",
        body: `${jobNumber}: "${jobTitle}" — ${revisionNotes || "Please revise and resubmit."}`,
        category: "REVISION_REQUESTED",
      });
    }
  } else if (toStage === "INVOICE_READY") {
    // Notify MCC
    if (job.created_by) {
      notifications.push({
        recipient_id: job.created_by as string,
        job_id: jobId,
        title: "Invoice ready to send",
        body: `${jobNumber}: "${jobTitle}" — invoice is ready. Please send to client.`,
        category: "INVOICE_READY",
      });
    }
  } else if (toStage === "PAYMENT_REPORTED") {
    const finance = await getFinanceTeam();
    finance.forEach(financeId => {
      notifications.push({
        recipient_id: financeId,
        job_id: jobId,
        title: "Payment reported — verify required",
        body: `${jobNumber}: "${jobTitle}" — client has reported payment. Please verify.`,
        category: "PAYMENT_VERIFICATION_REQUIRED",
      });
    });
  } else if (toStage === "COMPLETED") {
    const managers = await getManagers();
    managers.forEach(managerId => {
      notifications.push({
        recipient_id: managerId,
        job_id: jobId,
        title: "Job completed",
        body: `${jobNumber}: "${jobTitle}" has been closed successfully.`,
        category: "JOB_COMPLETED",
      });
    });
  }

  if (notifications.length > 0) {
    await admin.from("notifications").insert(notifications);
  }
}
