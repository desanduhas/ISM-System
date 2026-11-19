import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import JobsListClient from "./jobs-list-client";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  let profile;
  try {
    profile = await requireAuth();
  } catch {
    redirect("/login");
  }

  const admin = createAdminClient();
  let query = admin
    .from("jobs")
    .select("*, client:clients(id, company_name, contact_name), assigned_profile:profiles!jobs_assigned_to_fkey(id, full_name, role)")
    .order("created_at", { ascending: false });

  if (profile.role !== "MANAGEMENT") {
    if (profile.role === "FINANCE") {
      query = query.in("current_stage", [
        "APPROVED",
        "INVOICE_READY",
        "SENT_TO_CLIENT",
        "PAYMENT_REPORTED",
        "PAYMENT_VERIFIED",
        "COMPLETED",
      ]);
    } else {
      query = query.eq("assigned_to", profile.id);
    }
  }

  const [{ data: jobs }, { data: clients }, { data: profiles }] = await Promise.all([
    query,
    admin.from("clients").select("id, company_name").eq("is_active", true).order("company_name"),
    admin.from("profiles").select("id, full_name, role").eq("is_active", true).order("full_name"),
  ]);

  return (
    <JobsListClient
      jobs={jobs || []}
      clients={clients || []}
      profiles={profiles || []}
      profile={profile}
    />
  );
}
