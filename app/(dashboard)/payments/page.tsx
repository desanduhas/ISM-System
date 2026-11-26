import { requireAuth } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import PaymentsClient, { type PaymentsClientProps } from "./payments-client";

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

  const supabase = await createClient();

  const [
    { data: payments },
    { data: pendingInvoices },
    { data: activeJobs },
  ] = await Promise.all([
    supabase
      .from("payments")
      .select("*, invoice:invoices(id, invoice_number, total, client:clients(id, company_name, contact_name)), job:jobs(id, job_number, title), reported_by_profile:profiles!payments_reported_by_fkey(id, full_name), verified_by_profile:profiles!payments_verified_by_fkey(id, full_name)")
      .order("reported_at", { ascending: false })
      .overrideTypes<PaymentsClientProps["payments"], { merge: false }>(),
    supabase
      .from("invoices")
      .select("id, invoice_number, total, status, job_id, client_id, client:clients(company_name), job:jobs(id, job_number, title)")
      .not("status", "in", "(PAID,CANCELLED)")
      .order("created_at", { ascending: false })
      .overrideTypes<PaymentsClientProps["pendingInvoices"], { merge: false }>(),
    supabase
      .from("jobs")
      .select("id, job_number, title, current_stage, agreed_price, client:clients(company_name)")
      .in("current_stage", ["INVOICE_READY", "SENT_TO_CLIENT", "PAYMENT_REPORTED"])
      .order("updated_at", { ascending: false })
      .overrideTypes<PaymentsClientProps["activeJobs"], { merge: false }>(),
  ]);

  return (
    <PaymentsClient
      payments={payments || []}
      pendingInvoices={pendingInvoices || []}
      activeJobs={activeJobs || []}
      profile={profile}
    />
  );
}
