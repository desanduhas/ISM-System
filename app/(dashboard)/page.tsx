import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import ManagementDashboard from "@/components/dashboard/management-dashboard";
import EmployeeDashboard from "@/components/dashboard/employee-dashboard";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let profile;
  try {
    profile = await requireAuth();
  } catch {
    redirect("/login");
  }

  const admin = createAdminClient();

  if (profile.role === "MANAGEMENT") {
    // Fetch management stats
    const [
      { count: activeJobs },
      { count: pendingApproval },
      { count: overdueJobs },
      { count: pendingInvoices },
      { count: pendingPayments },
      { data: recentJobs },
    ] = await Promise.all([
      admin.from("jobs").select("id", { count: "exact", head: true }).not("current_stage", "in", "(COMPLETED,CANCELLED)"),
      admin.from("jobs").select("id", { count: "exact", head: true }).eq("current_stage", "READY_FOR_REVIEW"),
      admin.from("jobs").select("id", { count: "exact", head: true }).lt("deadline", new Date().toISOString()).not("current_stage", "in", "(COMPLETED,CANCELLED)"),
      admin.from("jobs").select("id", { count: "exact", head: true }).eq("current_stage", "APPROVED"),
      admin.from("payments").select("id", { count: "exact", head: true }).eq("status", "REPORTED"),
      admin.from("jobs").select("*, client:clients(company_name)").not("current_stage", "in", "(COMPLETED,CANCELLED)").order("updated_at", { ascending: false }).limit(8),
    ]);

    return (
      <ManagementDashboard
        stats={{
          activeJobs: activeJobs || 0,
          pendingApproval: pendingApproval || 0,
          overdueJobs: overdueJobs || 0,
          pendingInvoices: pendingInvoices || 0,
          pendingPayments: pendingPayments || 0,
        }}
        recentJobs={recentJobs || []}
        profile={profile}
      />
    );
  }

  // Employee dashboard
  const [{ data: assignedJobs }, { data: notifications }] = await Promise.all([
    admin.from("jobs").select("*, client:clients(company_name)").eq("assigned_to", profile.id).not("current_stage", "in", "(COMPLETED,CANCELLED)").order("updated_at", { ascending: false }),
    admin.from("notifications").select("*").eq("recipient_id", profile.id).eq("is_read", false).order("created_at", { ascending: false }).limit(5),
  ]);

  return (
    <EmployeeDashboard
      profile={profile}
      assignedJobs={assignedJobs || []}
      notifications={notifications || []}
    />
  );
}
