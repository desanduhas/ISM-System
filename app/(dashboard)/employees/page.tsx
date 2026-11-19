import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import EmployeesClient, { EmployeeWithStats } from "./employees-client";
import type { Department } from "@/lib/types";

export const metadata = {
  title: "Employee Management | ISM Flow",
  description: "Manage team members, roles, and workloads",
};

export default async function EmployeesPage() {
  let profile;
  try {
    profile = await requireAuth();
  } catch {
    redirect("/login");
  }

  // Management only check
  if (profile.role !== "MANAGEMENT") {
    redirect("/");
  }

  const admin = createAdminClient();

  // Fetch profiles, departments, active job counts
  const [
    { data: profiles, error: profilesErr },
    { data: departments, error: deptsErr },
    { data: activeJobs, error: jobsErr },
  ] = await Promise.all([
    admin
      .from("profiles")
      .select(`
        id,
        email,
        full_name,
        role,
        department_id,
        whatsapp_number,
        avatar_url,
        is_active,
        notification_preferences,
        created_at,
        updated_at,
        department:departments(id, name)
      `)
      .order("full_name", { ascending: true }),
    admin
      .from("departments")
      .select("*")
      .order("name", { ascending: true }),
    admin
      .from("jobs")
      .select("assigned_to")
      .not("current_stage", "in", '("COMPLETED","CANCELLED")')
      .not("assigned_to", "is", null),
  ]);

  if (profilesErr) {
    console.error("Error loading profiles:", profilesErr);
  }

  const workloadCounts: Record<string, number> = {};
  activeJobs?.forEach((job) => {
    if (job.assigned_to) {
      workloadCounts[job.assigned_to] = (workloadCounts[job.assigned_to] || 0) + 1;
    }
  });

  const employeesWithStats: EmployeeWithStats[] = (profiles || []).map((emp) => ({
    ...emp,
    department: (Array.isArray(emp.department) ? emp.department[0] : emp.department) as Department | null,
    active_jobs_count: workloadCounts[emp.id] || 0,
  }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <EmployeesClient
        initialEmployees={employeesWithStats}
        departments={departments || []}
      />
    </div>
  );
}
