"use client";

import ModuleMetrics from "@/app/(dashboard)/_components/module-metrics";

import OperationDialog from "@/app/(dashboard)/_components/operation-dialog";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Search,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Payment, Profile } from "@/lib/types";

export interface PaymentsClientProps {
  payments: Array<
    Payment & {
      invoice?: { id: string; invoice_number: string; total: number; client?: { company_name: string; contact_name: string } };
      job?: { id: string; job_number: string; title: string };
      reported_by_profile?: { id: string; full_name: string };
      verified_by_profile?: { id: string; full_name: string };
    }
  >;
  pendingInvoices: Array<{
    id: string;
    invoice_number: string;
    total: number;
    status: string;
    job_id: string;
    client_id: string;
    client?: { company_name: string };
    job?: { id: string; job_number: string; title: string };
  }>;
  activeJobs: Array<{
    id: string;
    job_number: string;
    title: string;
    current_stage: string;
    agreed_price: number | null;
    client?: { company_name: string };
  }>;
  profile: Profile;
}

const PAYMENT_METHODS = [
  "Bank Transfer (Online)",
  "Bank Deposit (CDM/Branch)",
  "Cash",
  "Cheque",
  "Credit / Debit Card",
  "Other",
];

export default function PaymentsClient({
  payments: initialPayments,
  pendingInvoices,
  activeJobs,
  profile,
}: PaymentsClientProps) {
  const router = useRouter();
  const [payments, setPayments] = useState(initialPayments);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState<"PENDING" | "ALL" | "VERIFIED" | "REJECTED">("PENDING");

  // Report modal state
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [amount, setAmount] = useState<number | "">("");
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [proofFile, setProofFile] = useState<File | null>(null);

  // Verification dialog state
  const [verifyingPayment, setVerifyingPayment] = useState<typeof payments[0] | null>(null);
  const [verificationNotes, setVerificationNotes] = useState("");
  const [verifySubmitting, setVerifySubmitting] = useState(false);

  const canVerify = ["FINANCE", "MANAGEMENT"].includes(profile.role);
  const canReport = ["MARKETING_CUSTOMER_CARE", "MANAGEMENT"].includes(profile.role);

  // Stats
  const stats = useMemo(() => {
    let pendingCount = 0;
    let pendingSum = 0;
    let verifiedCount = 0;
    let verifiedSum = 0;
    let rejectedCount = 0;

    for (const p of payments) {
      if (p.status === "REPORTED") {
        pendingCount++;
        pendingSum += Number(p.amount) || 0;
      } else if (p.status === "VERIFIED") {
        verifiedCount++;
        verifiedSum += Number(p.amount) || 0;
      } else if (p.status === "REJECTED") {
        rejectedCount++;
      }
    }

    return { pendingCount, pendingSum, verifiedCount, verifiedSum, rejectedCount };
  }, [payments]);

  // Filtered payments
  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchesTab =
        activeTab === "ALL"
          ? true
          : activeTab === "PENDING"
          ? p.status === "REPORTED"
          : p.status === activeTab;

      const search = searchTerm.toLowerCase();
      const matchesSearch =
        !search ||
        (p.invoice?.invoice_number && p.invoice.invoice_number.toLowerCase().includes(search)) ||
        (p.invoice?.client?.company_name && p.invoice.client.company_name.toLowerCase().includes(search)) ||
        (p.job?.job_number && p.job.job_number.toLowerCase().includes(search)) ||
        (p.job?.title && p.job.title.toLowerCase().includes(search)) ||
        (p.reference_number && p.reference_number.toLowerCase().includes(search));

      return matchesTab && matchesSearch;
    });
  }, [payments, activeTab, searchTerm]);

  // Invoice selection in report modal
  const handleInvoiceSelect = (invId: string) => {
    setSelectedInvoiceId(invId);
    const inv = pendingInvoices.find((i) => i.id === invId);
    if (inv) {
      setSelectedJobId(inv.job_id);
      setAmount(inv.total);
    }
  };

  // Report payment submit
  const handleReportPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId || !selectedJobId || !amount) {
      toast.error("Please fill in all required fields");
      return;
    }

    setReportSubmitting(true);
    try {
      let proofPath: string | undefined = undefined;

      // Upload proof file if provided
      if (proofFile) {
        const formData = new FormData();
        formData.append("file", proofFile);
        formData.append("bucket", "proofs");
        const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
        const uploadJson = await uploadRes.json();
        if (uploadRes.ok && uploadJson.data?.path) {
          proofPath = uploadJson.data.path;
        }
      }

      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoice_id: selectedInvoiceId,
          job_id: selectedJobId,
          amount: Number(amount),
          payment_method: paymentMethod,
          reference_number: referenceNumber || undefined,
          payment_date: paymentDate || undefined,
          proof_path: proofPath,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to report payment");

      toast.success("Payment reported successfully and queued for Finance verification!");
      setIsReportOpen(false);
      setPayments([json.data, ...payments]);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error reporting payment");
    } finally {
      setReportSubmitting(false);
    }
  };

  // Verify or reject payment submit
  const handleVerificationDecision = async (status: "VERIFIED" | "REJECTED") => {
    if (!verifyingPayment) return;
    setVerifySubmitting(true);
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          payment_id: verifyingPayment.id,
          status,
          verification_notes: verificationNotes || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to verify payment");

      toast.success(
        status === "VERIFIED"
          ? "Payment verified! Job stage updated."
          : "Payment rejected with feedback."
      );

      setPayments(
        payments.map((p) =>
          p.id === verifyingPayment.id
            ? {
                ...p,
                status,
                verified_by: profile.id,
                verified_by_profile: { id: profile.id, full_name: profile.full_name },
                verified_at: new Date().toISOString(),
                verification_notes: verificationNotes || null,
              }
            : p
        )
      );

      setVerifyingPayment(null);
      setVerificationNotes("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error updating payment status");
    } finally {
      setVerifySubmitting(false);
    }
  };

  return (
    <div className="operations-module module-payments">
      {/* Header */}
      <div className="module-heading flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Payments</h1>
        </div>
        {canReport && (
          <button
            onClick={() => setIsReportOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
          >
            <Plus size={16} />
            Report payment
          </button>
        )}
      </div>

      {/* Summary Stat Cards */}
      <ModuleMetrics items={[
        { label: "Awaiting verification", value: formatCurrency(stats.pendingSum), icon: Clock, detail: `${stats.pendingCount} pending` },
        { label: "Verified payments", value: formatCurrency(stats.verifiedSum), icon: CheckCircle2, detail: `${stats.verifiedCount} approved` },
        { label: "Rejected payments", value: stats.rejectedCount, icon: XCircle },
      ]} />

      {/* Filter and Search Bar */}
      <div className="module-toolbar bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          <button
            aria-pressed={activeTab === "PENDING"}
            onClick={() => setActiveTab("PENDING")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeTab === "PENDING"
                ? "bg-amber-600 text-white"
                : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <span>Pending Verification</span>
            {stats.pendingCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white text-amber-700 font-bold">
                {stats.pendingCount}
              </span>
            )}
          </button>
          <button
            aria-pressed={activeTab === "ALL"}
            onClick={() => setActiveTab("ALL")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === "ALL" ? "bg-purple-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            All Payments
          </button>
          <button
            aria-pressed={activeTab === "VERIFIED"}
            onClick={() => setActiveTab("VERIFIED")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === "VERIFIED" ? "bg-emerald-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            Verified History
          </button>
          <button
            aria-pressed={activeTab === "REJECTED"}
            onClick={() => setActiveTab("REJECTED")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition ${
              activeTab === "REJECTED" ? "bg-rose-600 text-white" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            Rejected
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            aria-label="Search invoice, client, ref"
            placeholder="Search invoice, client, ref..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50/50"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="module-table-scroll overflow-x-auto">
          <table className="module-table w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider font-semibold">
              <tr>
                <th scope="col" className="px-5 py-3.5">Reported</th>
                <th scope="col" className="px-5 py-3.5">Invoice #</th>
                <th scope="col" className="px-5 py-3.5">Job / Client</th>
                <th scope="col" className="px-5 py-3.5">Method & Ref</th>
                <th scope="col" className="px-5 py-3.5 text-right">Amount</th>
                <th scope="col" className="px-5 py-3.5">Status</th>
                <th scope="col" className="px-5 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    <CreditCard size={36} className="mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-slate-700">No payments found in this view</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {activeTab === "PENDING"
                        ? "Great job! All payments have been verified."
                        : "No matching payment records found."}
                    </p>
                  </td>
                </tr>
              ) : (
                filteredPayments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/70 transition">
                    <td data-label="Reported" className="px-5 py-4 whitespace-nowrap text-xs text-slate-600">
                      <div>{formatDate(p.reported_at)}</div>
                      <div className="text-slate-400">By {p.reported_by_profile?.full_name || "Staff"}</div>
                    </td>
                    <td data-label="Invoice #" className="px-5 py-4 font-semibold text-slate-900 whitespace-nowrap">
                      {p.invoice?.invoice_number || "—"}
                    </td>
                    <td data-label="Job / Client" className="px-5 py-4">
                      <div className="font-medium text-slate-900">
                        {p.invoice?.client?.company_name || "Client"}
                      </div>
                      {p.job && (
                        <Link
                          href={`/jobs/${p.job.id}`}
                          className="text-xs text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-1 mt-0.5"
                        >
                          {p.job.job_number}
                        </Link>
                      )}
                    </td>
                    <td data-label="Method & Ref" className="px-5 py-4 text-xs text-slate-600">
                      <div className="font-medium text-slate-800">{p.payment_method || "Direct Transfer"}</div>
                      <div className="text-slate-500 text-[11px] font-mono">
                        Ref: {p.reference_number || "N/A"}
                      </div>
                    </td>
                    <td data-label="Amount" className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="font-bold text-slate-900 text-base">{formatCurrency(p.amount)}</div>
                    </td>
                    <td data-label="Status" className="px-5 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          p.status === "VERIFIED"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : p.status === "REJECTED"
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        {p.status === "VERIFIED" && <Check size={12} />}
                        {p.status === "REJECTED" && <X size={12} />}
                        {p.status === "REPORTED" && <Clock size={12} />}
                        {p.status}
                      </span>
                    </td>
                    <td data-label="Action" className="px-5 py-4 text-right whitespace-nowrap">
                      {p.status === "REPORTED" && canVerify ? (
                        <button
                          onClick={() => setVerifyingPayment(p)}
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold transition shadow-sm"
                        >
                          Verify Payment
                        </button>
                      ) : (
                        <div className="text-xs text-slate-400">
                          {p.status === "VERIFIED" && p.verified_by_profile && (
                            <span>Verified by {p.verified_by_profile.full_name}</span>
                          )}
                          {p.verification_notes && (
                            <div className="text-[11px] text-slate-500 italic max-w-xs truncate">
                              &quot;{p.verification_notes}&quot;
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verify / Reject Modal */}
      {verifyingPayment && (
        <OperationDialog titleId="verify-payment-dialog" onDismiss={() => setVerifyingPayment(null)} className="max-w-lg w-full p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 id="verify-payment-dialog" className="text-lg font-bold text-slate-900">Verify Client Payment</h3>
            <button
              aria-label="Close dialog"
              onClick={() => setVerifyingPayment(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl space-y-2 text-xs border border-slate-200">
            <div className="flex justify-between">
              <span className="text-slate-500">Invoice:</span>
              <span className="font-bold text-slate-800">
                {verifyingPayment.invoice?.invoice_number || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Client:</span>
              <span className="font-semibold text-slate-800">
                {verifyingPayment.invoice?.client?.company_name || "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Payment Method:</span>
              <span className="text-slate-800">{verifyingPayment.payment_method}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Bank Reference #:</span>
              <span className="font-mono text-slate-900 font-bold">
                {verifyingPayment.reference_number || "None"}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-sm">
              <span className="font-semibold text-slate-700">Reported Amount:</span>
              <span className="font-extrabold text-purple-700">
                {formatCurrency(verifyingPayment.amount)}
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="payments-verification-notes-statement-match-1" className="block text-xs font-semibold text-slate-700 mb-1">
              Verification Notes / Statement Match
            </label>
            <textarea
              id="payments-verification-notes-statement-match-1"
              rows={2}
              placeholder="e.g., Confirmed credited to Commercial Bank A/C 1002345678"
              value={verificationNotes}
              onChange={(e) => setVerificationNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            />
          </div>

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              disabled={verifySubmitting}
              onClick={() => handleVerificationDecision("REJECTED")}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-semibold transition inline-flex items-center gap-1.5"
            >
              <XCircle size={15} />
              Reject / Mismatch
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVerifyingPayment(null)}
                className="px-3 py-2 text-slate-500 text-xs hover:bg-slate-50 rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={verifySubmitting}
                onClick={() => handleVerificationDecision("VERIFIED")}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-sm inline-flex items-center gap-1.5"
              >
                <CheckCircle2 size={15} />
                {verifySubmitting ? "Processing..." : "Confirm & Verify Payment"}
              </button>
            </div>
          </div>
        </OperationDialog>
      )}

      {/* Report Payment Modal */}
      {isReportOpen && (
        <OperationDialog titleId="report-payment-dialog" onDismiss={() => setIsReportOpen(false)} className="max-w-lg w-full p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 id="report-payment-dialog" className="text-lg font-bold text-slate-900">Report payment</h3>
              <p className="text-xs text-slate-500">Record a payment received from a client for finance verification</p>
            </div>
            <button
              aria-label="Close dialog"
              onClick={() => setIsReportOpen(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleReportPayment} className="space-y-3.5">
            <div>
              <label htmlFor="payments-select-unpaid-invoice-2" className="block text-xs font-semibold text-slate-700 mb-1">
                Select Unpaid Invoice *
              </label>
              <select
                id="payments-select-unpaid-invoice-2"
                value={selectedInvoiceId}
                onChange={(e) => handleInvoiceSelect(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              >
                <option value="">-- Choose Invoice --</option>
                {pendingInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} ({formatCurrency(inv.total)}) - {inv.client?.company_name || "Client"}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="payments-associated-job-3" className="block text-xs font-semibold text-slate-700 mb-1">
                Associated Job *
              </label>
              <select
                id="payments-associated-job-3"
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
              >
                <option value="">-- Choose Job --</option>
                {activeJobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.job_number} - {job.title} ({job.client?.company_name || "Client"})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="payments-amount-received-lkr-4" className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount Received (LKR) *
                </label>
                <input
                  id="payments-amount-received-lkr-4"
                  type="number"
                  min="1"
                  required
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label htmlFor="payments-payment-date-5" className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Date
                </label>
                <input
                  id="payments-payment-date-5"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="payments-payment-method-6" className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Method
                </label>
                <select
                  id="payments-payment-method-6"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="payments-reference-slip-7" className="block text-xs font-semibold text-slate-700 mb-1">
                  Reference / Slip #
                </label>
                <input
                  id="payments-reference-slip-7"
                  type="text"
                  placeholder="e.g. TXN-94810239"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="payments-attach-payment-proof-slip-optional-8" className="block text-xs font-semibold text-slate-700 mb-1">
                Attach Payment Proof / Slip (Optional)
              </label>
              <input
                id="payments-attach-payment-proof-slip-optional-8"
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setProofFile(e.target.files?.[0] || null)}
                className="w-full text-xs text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsReportOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reportSubmitting || !selectedInvoiceId}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-semibold transition shadow-sm"
              >
                {reportSubmitting ? "Reporting..." : "Submit Payment"}
              </button>
            </div>
          </form>
        </OperationDialog>
      )}
    </div>
  );
}
