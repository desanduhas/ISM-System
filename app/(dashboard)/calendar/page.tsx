import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import CalendarClient, { CalendarJob } from "./calendar-client";
import type { Department } from "@/lib/types";

export const metadata = {
  title: "Operations Calendar | ISM Flow",
  description: "Schedule of client visits, shoots, and deliverable deadlines",
};

export default async function CalendarPage() {
  let profile;
  try {
    profile = await requireAuth();
  } catch {
    redirect("/login");
  }

  const admin = createAdminClient();

  // 1. Build jobs query with role filtering
  let jobsQuery = admin
    .from("jobs")
    .select(`
      *,
      client:clients(id, company_name, contact_name, phone, whatsapp_number),
      assigned_profile:profiles!jobs_assigned_to_fkey(id, full_name, role),
      department:departments(id, name)
    `)
    .or("visit_date.not.is.null,deadline.not.is.null")
    .order("deadline", { ascending: true, nullsFirst: false });

  // Role permissions: Only MANAGEMENT has canViewCalendarAll
  if (profile.role !== "MANAGEMENT") {
    if (profile.role === "FINANCE") {
      jobsQuery = jobsQuery.in("current_stage", [
        "APPROVED",
        "INVOICE_READY",
        "SENT_TO_CLIENT",
        "PAYMENT_REPORTED",
        "PAYMENT_VERIFIED",
        "COMPLETED",
      ]);
    } else {
      // Designers, Capturing, Customer care see their assigned or created jobs
      jobsQuery = jobsQuery.or(`assigned_to.eq.${profile.id},created_by.eq.${profile.id}`);
    }
  }

  // 2. Fetch jobs, clients, employees, and departments concurrently
  const [
    { data: jobs, error: jobsErr },
    { data: clients, error: clientsErr },
    { data: employees, error: empErr },
    { data: departments, error: deptsErr },
  ] = await Promise.all([
    jobsQuery,
    admin
      .from("clients")
      .select("id, company_name")
      .eq("is_active", true)
      .order("company_name", { ascending: true }),
    admin
      .from("profiles")
      .select("id, full_name, role, department_id")
      .eq("is_active", true)
      .order("full_name", { ascending: true }),
    admin
      .from("departments")
      .select("*")
      .order("name", { ascending: true }),
  ]);

  if (jobsErr) {
    console.error("Error loading calendar jobs:", jobsErr);
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <CalendarClient
        initialJobs={(jobs as unknown as CalendarJob[]) || []}
        clients={clients || []}
        employees={employees || []}
        departments={departments || []}
        currentUser={profile}
      />
    </div>
  );
}
