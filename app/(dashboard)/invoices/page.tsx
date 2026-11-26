import { requireAuth } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import InvoicesClient, { type InvoicesClientProps } from "./invoices-client";

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

  const supabase = await createClient();

  const [
    { data: invoices },
    { data: eligibleJobs },
    { data: clients },
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("*, client:clients(id, company_name, contact_name, phone, email), job:jobs(id, job_number, title)")
      .order("created_at", { ascending: false })
      .overrideTypes<InvoicesClientProps["invoices"], { merge: false }>(),
    supabase
      .from("jobs")
      .select("id, job_number, title, agreed_price, current_stage, client_id, client:clients(id, company_name)")
      .in("current_stage", ["APPROVED", "INVOICE_READY"])
      .order("updated_at", { ascending: false })
      .overrideTypes<InvoicesClientProps["eligibleJobs"], { merge: false }>(),
    supabase
      .from("clients")
      .select("id, company_name, contact_name")
      .eq("is_active", true)
      .order("company_name", { ascending: true }),
  ]);

  return (
    <InvoicesClient
      invoices={invoices || []}
      eligibleJobs={eligibleJobs || []}
      clients={clients || []}
      profile={profile}
    />
  );
}
