"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Calendar,
  CreditCard,
  Briefcase,
  ArrowLeft,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  ExternalLink,
} from "lucide-react";
import {
  formatCurrency,
  formatDate,
  formatSriLankanPhone,
  STAGE_LABELS,
  STAGE_COLORS,
  isOverdue,
} from "@/lib/utils";
import type { Client, Job, Invoice, Payment, Profile } from "@/lib/types";

interface JobWithProfile extends Omit<Job, "assigned_profile"> {
  assigned_profile?: {
    id: string;
    full_name: string;
    role: string;
  } | null;
}

interface PaymentWithInvoice extends Payment {
  invoice?: {
    invoice_number: string;
  } | null;
}

interface ClientDetailClientProps {
  client: Client;
  jobs: JobWithProfile[];
  invoices: Invoice[];
  payments: PaymentWithInvoice[];
  currentUser: Profile;
}

const INVOICE_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  ISSUED: "bg-blue-100 text-blue-700 border-blue-200",
  SENT: "bg-cyan-100 text-cyan-700 border-cyan-200",
  PAID: "bg-emerald-100 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-rose-100 text-rose-700 border-rose-200",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  REPORTED: "bg-amber-100 text-amber-700 border-amber-200",
  VERIFIED: "bg-emerald-100 text-emerald-700 border-emerald-200",
  REJECTED: "bg-rose-100 text-rose-700 border-rose-200",
};

export default function ClientDetailClient({
  client,
  jobs,
  invoices,
  payments,
  currentUser,
}: ClientDetailClientProps) {
  const [activeTab, setActiveTab] = useState<"jobs" | "invoices" | "payments">("jobs");

  // Calculations
  const activeJobs = jobs.filter(
    (j) => !["COMPLETED", "CANCELLED"].includes(j.current_stage)
  );
  const completedJobs = jobs.filter((j) => j.current_stage === "COMPLETED");

  const totalBilled = invoices
    .filter((inv) => inv.status !== "CANCELLED")
    .reduce((sum, inv) => sum + Number(inv.total || 0), 0);

  const totalPaid = payments
    .filter((p) => p.status === "VERIFIED")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const pendingVerification = payments
    .filter((p) => p.status === "REPORTED")
    .reduce((sum, p) => sum + Number(p.amount || 0), 0);

  const outstandingBalance = Math.max(0, totalBilled - totalPaid);

  const waDigits = client.whatsapp_number
    ? client.whatsapp_number.replace(/\D/g, "")
    : null;

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/clients"
            className="p-2 bg-white rounded-lg border border-slate-200 text-slate-600 hover:text-purple-600 hover:border-purple-200 transition-colors shadow-sm"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                {client.company_name}
              </h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                  client.is_active
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-slate-100 text-slate-600 border border-slate-200"
                }`}
              >
                {client.is_active ? "Active Client" : "Inactive"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Client profile & transaction records • Registered on{" "}
              {formatDate(client.created_at)}
            </p>
          </div>
        </div>

        {/* Quick Contact Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {client.whatsapp_number && (
            <a
              href={`https://wa.me/${waDigits}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-medium transition-colors"
            >
              <MessageSquare size={14} />
              WhatsApp
            </a>
          )}
          {client.phone && (
            <a
              href={`tel:${client.phone}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors"
            >
              <Phone size={14} />
              Call
            </a>
          )}
          {client.email && (
            <a
              href={`mailto:${client.email}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium transition-colors"
            >
              <Mail size={14} />
              Email
            </a>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">
              Total Invoiced
            </span>
            <Receipt size={18} className="text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-slate-900">
            {formatCurrency(totalBilled)}
          </p>
          <p className="text-xs text-slate-400 mt-1">{invoices.length} invoices generated</p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">
              Total Collected
            </span>
            <CheckCircle2 size={18} className="text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">
            {formatCurrency(totalPaid)}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {payments.filter((p) => p.status === "VERIFIED").length} verified payments
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">
              Outstanding Balance
            </span>
            <AlertTriangle
              size={18}
              className={outstandingBalance > 0 ? "text-rose-500" : "text-slate-400"}
            />
          </div>
          <p
            className={`text-2xl font-bold ${
              outstandingBalance > 0 ? "text-rose-600" : "text-slate-900"
            }`}
          >
            {formatCurrency(outstandingBalance)}
          </p>
          {pendingVerification > 0 && (
            <p className="text-xs text-amber-600 mt-1">
              ({formatCurrency(pendingVerification)} pending verification)
            </p>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">Jobs Overview</span>
            <Briefcase size={18} className="text-blue-600" />
          </div>
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-slate-900">{activeJobs.length}</p>
            <span className="text-xs text-slate-500">active</span>
            <span className="text-slate-300">/</span>
            <p className="text-lg font-semibold text-slate-600">{jobs.length}</p>
            <span className="text-xs text-slate-500">total</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            {completedJobs.length} completed successfully
          </p>
        </div>
      </div>

      {/* Main Grid: Details + Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Client Details */}
        <div className="lg:col-span-1 bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h2 className="text-base font-semibold text-slate-900 border-b border-slate-100 pb-3">
            Client Profile
          </h2>

          <div className="space-y-3.5 text-sm">
            <div>
              <p className="text-xs text-slate-400">Primary Contact Person</p>
              <p className="font-medium text-slate-800 flex items-center gap-1.5 mt-0.5">
                <User size={15} className="text-slate-400" />
                {client.contact_name}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">Email Address</p>
              <p className="font-medium text-slate-800 flex items-center gap-1.5 mt-0.5">
                <Mail size={15} className="text-slate-400" />
                {client.email || "—"}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">Phone</p>
              <p className="font-medium text-slate-800 flex items-center gap-1.5 mt-0.5">
                <Phone size={15} className="text-slate-400" />
                {client.phone ? formatSriLankanPhone(client.phone) : "—"}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">WhatsApp</p>
              <p className="font-medium text-emerald-700 flex items-center gap-1.5 mt-0.5">
                <MessageSquare size={15} className="text-emerald-500" />
                {client.whatsapp_number
                  ? formatSriLankanPhone(client.whatsapp_number)
                  : "—"}
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">Billing Address</p>
              <p className="font-medium text-slate-800 flex items-start gap-1.5 mt-0.5">
                <MapPin size={15} className="text-slate-400 shrink-0 mt-0.5" />
                <span>{client.billing_address || "—"}</span>
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-400">Tax / VAT Registration</p>
              <p className="font-medium text-slate-800 flex items-center gap-1.5 mt-0.5">
                <FileText size={15} className="text-slate-400" />
                {client.tax_registration || "—"}
              </p>
            </div>

            {client.notes && (
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-1">Operational Notes</p>
                <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 leading-relaxed">
                  {client.notes}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Tabs for Jobs, Invoices, Payments */}
        <div className="lg:col-span-2 space-y-4">
          {/* Tab Navigation */}
          <div className="flex border-b border-slate-200 bg-white px-4 rounded-t-xl">
            <button
              onClick={() => setActiveTab("jobs")}
              className={`py-3.5 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "jobs"
                  ? "border-purple-600 text-purple-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Briefcase size={16} />
              Jobs ({jobs.length})
            </button>

            <button
              onClick={() => setActiveTab("invoices")}
              className={`py-3.5 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "invoices"
                  ? "border-purple-600 text-purple-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Receipt size={16} />
              Invoices ({invoices.length})
            </button>

            <button
              onClick={() => setActiveTab("payments")}
              className={`py-3.5 px-4 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === "payments"
                  ? "border-purple-600 text-purple-600"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <CreditCard size={16} />
              Payments ({payments.length})
            </button>
          </div>

          {/* Tab Content: Jobs */}
          {activeTab === "jobs" && (
            <div className="bg-white rounded-b-xl border border-slate-200 border-t-0 p-5 shadow-sm space-y-4">
              {jobs.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  No jobs created for this client yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {jobs.map((job) => {
                    const overdue =
                      isOverdue(job.deadline) &&
                      !["COMPLETED", "CANCELLED"].includes(job.current_stage);

                    return (
                      <div
                        key={job.id}
                        className={`p-4 rounded-xl border transition-all ${
                          overdue
                            ? "border-rose-300 bg-rose-50/30"
                            : "border-slate-200 hover:border-purple-200 bg-white"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded">
                              {job.job_number}
                            </span>
                            <Link
                              href={`/jobs/${job.id}`}
                              className="font-semibold text-slate-900 hover:text-purple-600 text-sm"
                            >
                              {job.title}
                            </Link>
                          </div>

                          <div className="flex items-center gap-2">
                            {overdue && (
                              <span className="text-[11px] font-semibold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">
                                Overdue
                              </span>
                            )}
                            <span
                              className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${
                                STAGE_COLORS[job.current_stage] ||
                                "bg-slate-100 text-slate-800"
                              }`}
                            >
                              {STAGE_LABELS[job.current_stage] || job.current_stage}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-slate-500 pt-2 border-t border-slate-100">
                          <div>
                            <span className="block text-slate-400">Type</span>
                            <span className="font-medium text-slate-700">{job.job_type}</span>
                          </div>

                          <div>
                            <span className="block text-slate-400">Assigned To</span>
                            <span className="font-medium text-slate-700">
                              {job.assigned_profile?.full_name || "Unassigned"}
                            </span>
                          </div>

                          <div>
                            <span className="block text-slate-400">Deadline</span>
                            <span className="font-medium text-slate-700">
                              {formatDate(job.deadline)}
                            </span>
                          </div>

                          <div>
                            <span className="block text-slate-400">Agreed Price</span>
                            <span className="font-medium text-slate-700">
                              {job.agreed_price ? formatCurrency(job.agreed_price) : "—"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab Content: Invoices */}
          {activeTab === "invoices" && (
            <div className="bg-white rounded-b-xl border border-slate-200 border-t-0 p-5 shadow-sm">
              {invoices.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  No invoices recorded for this client.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 uppercase text-slate-400 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Invoice #</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Issued Date</th>
                        <th className="py-2.5 px-3">Due Date</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-3 font-mono font-medium text-slate-900">
                            {inv.invoice_number}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                INVOICE_STATUS_COLORS[inv.status] || "bg-slate-100"
                              }`}
                            >
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {formatDate(inv.issued_at || inv.created_at)}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {formatDate(inv.due_date)}
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-slate-900">
                            {formatCurrency(inv.total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Tab Content: Payments */}
          {activeTab === "payments" && (
            <div className="bg-white rounded-b-xl border border-slate-200 border-t-0 p-5 shadow-sm">
              {payments.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  No payment records found for this client.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 uppercase text-slate-400 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Invoice #</th>
                        <th className="py-2.5 px-3">Reference</th>
                        <th className="py-2.5 px-3">Method</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/80">
                          <td className="py-3 px-3 font-medium text-slate-900">
                            {formatDate(p.payment_date || p.reported_at)}
                          </td>
                          <td className="py-3 px-3 font-mono text-purple-700">
                            {p.invoice?.invoice_number || "—"}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {p.reference_number || "—"}
                          </td>
                          <td className="py-3 px-3 text-slate-600">
                            {p.payment_method || "Bank Transfer"}
                          </td>
                          <td className="py-3 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${
                                PAYMENT_STATUS_COLORS[p.status] || "bg-slate-100"
                              }`}
                            >
                              {p.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right font-semibold text-emerald-600">
                            {formatCurrency(p.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
