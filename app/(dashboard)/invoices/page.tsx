import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import InvoicesClient from "./invoices-client";

export default async function InvoicesPage() {
  let profile;
  try {
    profile = await requireAuth();
  } catch {
    redirect("/login");
  }

  // Permitted roles: MANAGEMENT, FINANCE, MARKETING_CUSTOMER_CARE
  if (!["MANAGEMENT", "FINANCE", "MARKETING_CUSTOMER_CARE"].includes(profile.role)) {
    redirect("/");
  }

  const admin = createAdminClient();

  const [
    { data: invoices },
    { data: eligibleJobs },
    { data: clients },
  ] = await Promise.all([
    admin
      .from("invoices")
      .select("*, client:clients(id, company_name, contact_name, phone, email), job:jobs(id, job_number, title)")
      .order("created_at", { ascending: false }),
    admin
      .from("jobs")
      .select("id, job_number, title, agreed_price, current_stage, client_id, client:clients(id, company_name)")
      .in("current_stage", ["APPROVED", "INVOICE_READY"])
      .order("updated_at", { ascending: false }),
    admin
      .from("clients")
      .select("id, company_name, contact_name")
      .eq("is_active", true)
      .order("company_name", { ascending: true }),
  ]);

  return (
    <InvoicesClient
      invoices={(invoices as any) || []}
      eligibleJobs={(eligibleJobs as any) || []}
      clients={(clients as any) || []}
      profile={profile}
    />
  );
}
