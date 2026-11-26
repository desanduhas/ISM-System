import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import ClientsClient, { ClientWithStats } from "./clients-client";

export const metadata = {
  title: "Clients Management | ISM Flow",
  description: "Client accounts, contacts, and job records",
};

export default async function ClientsPage() {
  let profile;
  try {
    profile = await requireAuth();
  } catch {
    redirect("/login");
  }

  const admin = createAdminClient();

  // Fetch all clients and active jobs grouped by client
  const [
    { data: clients, error: clientsErr },
    { data: jobs },
  ] = await Promise.all([
    admin
      .from("clients")
      .select("*")
      .order("company_name", { ascending: true }),
    admin
      .from("jobs")
      .select("id, client_id, current_stage"),
  ]);

  if (clientsErr) {
    console.error("Error loading clients:", clientsErr);
  }

  const activeJobsMap: Record<string, number> = {};
  const totalJobsMap: Record<string, number> = {};

  (jobs || []).forEach((j) => {
    totalJobsMap[j.client_id] = (totalJobsMap[j.client_id] || 0) + 1;
    if (!["COMPLETED", "CANCELLED"].includes(j.current_stage)) {
      activeJobsMap[j.client_id] = (activeJobsMap[j.client_id] || 0) + 1;
    }
  });

  const clientsWithStats: ClientWithStats[] = (clients || []).map((c) => ({
    ...c,
    active_jobs_count: activeJobsMap[c.id] || 0,
    total_jobs_count: totalJobsMap[c.id] || 0,
  }));

  return (
    <ClientsClient initialClients={clientsWithStats} userProfile={profile} />
  );
}
