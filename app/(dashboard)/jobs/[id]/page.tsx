import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect, notFound } from "next/navigation";
import JobDetailClient from "./job-detail-client";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let profile;
  try {
    profile = await requireAuth();
  } catch {
    redirect("/login");
  }

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
      invoices(id, invoice_number, status, total, pdf_path, due_date, created_at),
      payments(*, reported_by_profile:profiles!payments_reported_by_fkey(id, full_name))
    `)
    .eq("id", id)
    .single();

  if (error || !job) {
    notFound();
  }

  // Access control
  const canView =
    profile.role === "MANAGEMENT" ||
    job.assigned_to === profile.id ||
    job.created_by === profile.id ||
    (profile.role === "FINANCE" &&
      [
        "APPROVED",
        "INVOICE_READY",
        "SENT_TO_CLIENT",
        "PAYMENT_REPORTED",
        "PAYMENT_VERIFIED",
        "COMPLETED",
      ].includes(job.current_stage));

  if (!canView) {
    redirect("/jobs");
  }

  return <JobDetailClient job={job} profile={profile} />;
}
