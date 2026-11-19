import { notFound, redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import ClientDetailClient from "./client-detail-client";
import type { Client, Invoice, Payment } from "@/lib/types";

export const metadata = {
  title: "Client Profile & History | ISM Flow",
  description: "View client information, jobs, and financial transactions",
};

export default async function ClientDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  let profile;
  try {
    profile = await requireAuth();
  } catch {
    redirect("/login");
  }

  const { id } = await props.params;
  const admin = createAdminClient();

  // 1. Fetch client
  const { data: client, error: clientErr } = await admin
    .from("clients")
    .select("*")
    .eq("id", id)
    .single();

  if (clientErr || !client) {
    notFound();
  }

  // 2. Fetch jobs associated with client
  const { data: jobs, error: jobsErr } = await admin
    .from("jobs")
    .select(`
      *,
      assigned_profile:profiles!jobs_assigned_to_fkey(id, full_name, role)
    `)
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  if (jobsErr) {
    console.error("Error loading jobs for client:", jobsErr);
  }

  // 3. Fetch invoices for client
  const { data: invoices, error: invErr } = await admin
    .from("invoices")
    .select("*")
    .eq("client_id", id)
    .order("created_at", { ascending: false });

  if (invErr) {
    console.error("Error loading invoices for client:", invErr);
  }

  const invoiceIds = (invoices || []).map((i) => i.id);

  // 4. Fetch payments
  let payments: Payment[] = [];
  if (invoiceIds.length > 0) {
    const { data: paymentsData, error: payErr } = await admin
      .from("payments")
      .select(`
        *,
        invoice:invoices(invoice_number)
      `)
      .in("invoice_id", invoiceIds)
      .order("created_at", { ascending: false });

    if (!payErr && paymentsData) {
      payments = paymentsData as unknown as Payment[];
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <ClientDetailClient
        client={client as Client}
        jobs={(jobs as unknown as Parameters<typeof ClientDetailClient>[0]["jobs"]) || []}
        invoices={invoices || []}
        payments={payments}
        currentUser={profile}
      />
    </div>
  );
}
