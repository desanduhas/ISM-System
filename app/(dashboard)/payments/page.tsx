import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import PaymentsClient from "./payments-client";

export default async function PaymentsPage() {
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
    { data: payments },
    { data: pendingInvoices },
    { data: activeJobs },
  ] = await Promise.all([
    admin
      .from("payments")
      .select("*, invoice:invoices(id, invoice_number, total, client:clients(id, company_name, contact_name)), job:jobs(id, job_number, title), reported_by_profile:profiles!payments_reported_by_fkey(id, full_name), verified_by_profile:profiles!payments_verified_by_fkey(id, full_name)")
      .order("reported_at", { ascending: false }),
    admin
      .from("invoices")
      .select("id, invoice_number, total, status, job_id, client_id, client:clients(company_name), job:jobs(id, job_number, title)")
      .not("status", "in", "(PAID,CANCELLED)")
      .order("created_at", { ascending: false }),
    admin
      .from("jobs")
      .select("id, job_number, title, current_stage, agreed_price, client:clients(company_name)")
      .in("current_stage", ["INVOICE_READY", "SENT_TO_CLIENT", "PAYMENT_REPORTED"])
      .order("updated_at", { ascending: false }),
  ]);

  return (
    <PaymentsClient
      payments={(payments as any) || []}
      pendingInvoices={(pendingInvoices as any) || []}
      activeJobs={(activeJobs as any) || []}
      profile={profile}
    />
  );
}
