"use client";

import ModuleMetrics from "@/app/(dashboard)/_components/module-metrics";

import OperationDialog from "@/app/(dashboard)/_components/operation-dialog";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  FileText,
  Plus,
  Search,
  Download,
  Trash2,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Invoice, Client, Job, Profile, InvoiceLineItem } from "@/lib/types";

export interface InvoicesClientProps {
  invoices: Array<Omit<Invoice, "client" | "job"> & {
    client?: Pick<Client, "id" | "company_name" | "contact_name" | "phone" | "email">;
    job?: Pick<Job, "id" | "job_number" | "title">;
  }>;
  eligibleJobs: Array<{
    id: string;
    job_number: string;
    title: string;
    agreed_price: number | null;
    current_stage: string;
    client_id: string;
    client?: { id: string; company_name: string };
  }>;
  clients: Array<{ id: string; company_name: string; contact_name: string }>;
  profile: Profile;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700 border-slate-200",
  ISSUED: "bg-blue-50 text-blue-700 border-blue-200",
  SENT: "bg-amber-50 text-amber-700 border-amber-200",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-rose-50 text-rose-700 border-rose-200",
};

export default function InvoicesClient({
  invoices: initialInvoices,
  eligibleJobs,
  clients,
  profile,
}: InvoicesClientProps) {
  const router = useRouter();
  const [invoices, setInvoices] = useState(initialInvoices);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state for creating invoice
  const [selectedJobId, setSelectedJobId] = useState("");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [discount, setDiscount] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0);
  const [paymentInstructions, setPaymentInstructions] = useState(
    "Please transfer payment to: Commercial Bank PLC, Branch: Kollupitiya, A/C: 1002345678, Beneficiary: ISM Flow (Pvt) Ltd. Send remittance slip to accounts@ismflow.lk"
  );
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    { description: "Creative & Production Services", quantity: 1, unit_price: 50000, amount: 50000 },
  ]);

  const canManageInvoices = ["FINANCE", "MANAGEMENT"].includes(profile.role);

  // Stats calculation
  const stats = useMemo(() => {
    let totalBilled = 0;
    let paidTotal = 0;
    let pendingTotal = 0;
    let draftCount = 0;

    for (const inv of invoices) {
      if (inv.status !== "CANCELLED") {
        totalBilled += inv.total || 0;
      }
      if (inv.status === "PAID") {
        paidTotal += inv.total || 0;
      } else if (inv.status === "ISSUED" || inv.status === "SENT") {
        pendingTotal += inv.total || 0;
      } else if (inv.status === "DRAFT") {
        draftCount++;
      }
    }

    return { totalBilled, paidTotal, pendingTotal, draftCount };
  }, [invoices]);

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesStatus = statusFilter === "ALL" || inv.status === statusFilter;
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        !search ||
        (inv.invoice_number && inv.invoice_number.toLowerCase().includes(search)) ||
        (inv.client?.company_name && inv.client.company_name.toLowerCase().includes(search)) ||
        (inv.job?.job_number && inv.job.job_number.toLowerCase().includes(search)) ||
        (inv.job?.title && inv.job.title.toLowerCase().includes(search));

      return matchesStatus && matchesSearch;
    });
  }, [invoices, statusFilter, searchTerm]);

  // Handle job selection in create modal
  const handleJobSelect = (jobId: string) => {
    setSelectedJobId(jobId);
    const job = eligibleJobs.find((j) => j.id === jobId);
    if (job) {
      setSelectedClientId(job.client_id);
      const price = job.agreed_price || 50000;
      setLineItems([
        {
          description: `${job.title} (${job.job_number})`,
          quantity: 1,
          unit_price: price,
          amount: price,
        },
      ]);
    }
  };

  // Line item handlers
  const updateLineItem = (index: number, field: keyof InvoiceLineItem, value: string | number) => {
    const updated = [...lineItems];
    const item = { ...updated[index], [field]: value };
    if (field === "quantity" || field === "unit_price") {
      const q = Number(item.quantity) || 0;
      const p = Number(item.unit_price) || 0;
      item.amount = q * p;
    }
    updated[index] = item;
    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: "", quantity: 1, unit_price: 0, amount: 0 }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  // Live calculation of totals for create modal
  const subtotal = lineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const discounted = Math.max(0, subtotal - (Number(discount) || 0));
  const taxAmount = (discounted * (Number(taxRate) || 0)) / 100;
  const grandTotal = discounted + taxAmount;

  // Handle invoice submission
  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedJobId || !selectedClientId) {
      toast.error("Please select both a job and a client");
      return;
    }
    if (lineItems.length === 0 || !lineItems[0].description) {
      toast.error("Please provide at least one valid line item");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: selectedJobId,
          client_id: selectedClientId,
          line_items: lineItems.map((item) => ({
            description: item.description,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            amount: Number(item.amount),
          })),
          discount: Number(discount) || 0,
          tax_rate: Number(taxRate) || 0,
          due_date: dueDate || undefined,
          payment_instructions: paymentInstructions || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create invoice");

      toast.success(`Invoice ${json.data.invoice_number || "Draft"} created successfully!`);
      setInvoices([json.data, ...invoices]);
      setIsCreateOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error creating invoice");
    } finally {
      setSubmitting(false);
    }
  };

  // Status update handler (issued, sent, paid, etc.)
  const handleStatusChange = async (invoiceId: string, newStatus: Invoice["status"]) => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update status");

      toast.success(`Invoice marked as ${newStatus}`);
      setInvoices((current) => current.map((inv) => (inv.id === invoiceId ? { ...inv, status: newStatus } : inv)));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Status update failed");
    }
  };

  return (
    <div className="operations-module module-invoices">
      {/* Header */}
      <div className="module-heading flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Invoices</h1>
        </div>
        {canManageInvoices && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
          >
            <Plus size={16} />
            Create Invoice
          </button>
        )}
      </div>

      {/* Metric Cards */}
      <ModuleMetrics items={[
        { label: "Total invoiced", value: formatCurrency(stats.totalBilled), icon: DollarSign },
        { label: "Paid", value: formatCurrency(stats.paidTotal), icon: CheckCircle2 },
        { label: "Awaiting payment", value: formatCurrency(stats.pendingTotal), icon: Clock },
        { label: "Draft invoices", value: stats.draftCount, icon: FileText },
      ]} />

      {/* Filter and Search Bar */}
      <div className="module-toolbar bg-white rounded-xl border border-slate-200 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
          {["ALL", "DRAFT", "ISSUED", "SENT", "PAID", "CANCELLED"].map((status) => (
            <button
              key={status}
              aria-pressed={statusFilter === status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                statusFilter === status
                  ? "bg-purple-600 text-white"
                  : "bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search size={16} className="absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            aria-label="Search invoice, client, job"
            placeholder="Search invoice, client, job..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50/50"
          />
        </div>
      </div>

      {/* Invoices List / Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="module-table-scroll overflow-x-auto">
          <table className="module-table w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-xs uppercase tracking-wider font-semibold">
              <tr>
                <th scope="col" className="px-5 py-3.5">Invoice #</th>
                <th scope="col" className="px-5 py-3.5">Client</th>
                <th scope="col" className="px-5 py-3.5">Job Ref</th>
                <th scope="col" className="px-5 py-3.5">Date / Due</th>
                <th scope="col" className="px-5 py-3.5 text-right">Amount</th>
                <th scope="col" className="px-5 py-3.5">Status</th>
                <th scope="col" className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                    <FileText size={36} className="mx-auto text-slate-300 mb-2" />
                    <p className="font-medium text-slate-700">No invoices found</p>
                    <p className="text-xs text-slate-400 mt-1">Try adjusting your filters or create a new invoice</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70 transition">
                    <td data-label="Invoice #" className="px-5 py-4 font-semibold text-slate-900 whitespace-nowrap">
                      {inv.invoice_number || "DRAFT"}
                    </td>
                    <td data-label="Client" className="px-5 py-4">
                      <div className="font-medium text-slate-900">{inv.client?.company_name || "—"}</div>
                      <div className="text-xs text-slate-500">{inv.client?.contact_name}</div>
                    </td>
                    <td data-label="Job Ref" className="px-5 py-4">
                      {inv.job ? (
                        <Link
                          href={`/jobs/${inv.job.id}`}
                          className="group inline-flex items-center gap-1 text-purple-600 hover:text-purple-700 font-medium"
                        >
                          <span>{inv.job.job_number}</span>
                          <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 transition" />
                        </Link>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                      <div className="text-xs text-slate-500 truncate max-w-xs">{inv.job?.title}</div>
                    </td>
                    <td data-label="Date / Due" className="px-5 py-4 text-xs text-slate-600 whitespace-nowrap">
                      <div>Issued: {formatDate(inv.created_at)}</div>
                      <div className="text-slate-400">Due: {formatDate(inv.due_date)}</div>
                    </td>
                    <td data-label="Amount" className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="font-bold text-slate-900">{formatCurrency(inv.total)}</div>
                      {inv.tax_amount > 0 && (
                        <div className="text-xs text-slate-400">Tax: {formatCurrency(inv.tax_amount)}</div>
                      )}
                    </td>
                    <td data-label="Status" className="px-5 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                          STATUS_COLORS[inv.status] || "bg-slate-100 text-slate-700 border-slate-200"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td data-label="Actions" className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {/* Download PDF button */}
                        <a
                          href={`/api/invoices/${inv.id}/pdf`}
                          target="_blank"
                          rel="noreferrer"
                          title="Download PDF"
                          className="p-1.5 text-slate-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                        >
                          <Download size={16} />
                        </a>

                        {/* Status dropdown for Finance / Management */}
                        {canManageInvoices && inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                          <select
                            value={inv.status}
                            onChange={(e) => handleStatusChange(inv.id, e.target.value as Invoice["status"])}
                            className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
                          >
                            <option value="DRAFT">DRAFT</option>
                            <option value="ISSUED">ISSUED</option>
                            <option value="SENT">SENT</option>
                            <option value="PAID">PAID</option>
                            <option value="CANCELLED">CANCELLED</option>
                          </select>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Invoice Dialog Modal */}
      {isCreateOpen && (
        <OperationDialog titleId="new-invoice-dialog" onDismiss={() => setIsCreateOpen(false)} className="max-w-2xl w-full p-6 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 id="new-invoice-dialog" className="text-lg font-bold text-slate-900">Create New Invoice</h3>
              <p className="text-xs text-slate-500">Bill a client for approved marketing & production work</p>
            </div>
            <button
              aria-label="Close dialog"
              onClick={() => setIsCreateOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleCreateInvoice} className="space-y-4">
            {/* Job & Client Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="invoices-select-approved-job-1" className="block text-xs font-semibold text-slate-700 mb-1">
                  Select Approved Job *
                </label>
                <select
                  id="invoices-select-approved-job-1"
                  value={selectedJobId}
                  onChange={(e) => handleJobSelect(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="">-- Choose Job --</option>
                  {eligibleJobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.job_number} - {job.title} ({job.client?.company_name || "Client"})
                    </option>
                  ))}
                </select>
                {eligibleJobs.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No jobs currently in APPROVED or INVOICE_READY stage.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="invoices-client-2" className="block text-xs font-semibold text-slate-700 mb-1">Client *</label>
                <select
                  id="invoices-client-2"
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                >
                  <option value="">-- Choose Client --</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.company_name} ({c.contact_name})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Due Date & Instructions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="invoices-due-date-3" className="block text-xs font-semibold text-slate-700 mb-1">Due Date</label>
                <input
                  id="invoices-due-date-3"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label htmlFor="invoices-tax-rate-4" className="block text-xs font-semibold text-slate-700 mb-1">
                  Tax Rate (%)
                </label>
                <input
                  id="invoices-tax-rate-4"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={taxRate}
                  onChange={(e) => setTaxRate(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Line Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Line Items
                </label>
                <button
                  type="button"
                  onClick={addLineItem}
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-1"
                >
                  <Plus size={14} /> Add Item
                </button>
              </div>

              <div className="space-y-2">
                {lineItems.map((item, idx) => (
                  <div key={idx} className="invoice-line-item flex items-center gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                    <input
                      type="text"
                      aria-label="Description"
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => updateLineItem(idx, "description", e.target.value)}
                      required
                      className="flex-1 px-2.5 py-1.5 text-xs border border-slate-200 rounded bg-white"
                    />
                    <input
                      type="number"
                      aria-label="Qty"
                      placeholder="Qty"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => updateLineItem(idx, "quantity", Number(e.target.value))}
                      required
                      className="w-16 px-2 py-1.5 text-xs border border-slate-200 rounded text-right bg-white"
                    />
                    <input
                      type="number"
                      aria-label="Unit Price"
                      placeholder="Unit Price"
                      min="0"
                      value={item.unit_price}
                      onChange={(e) => updateLineItem(idx, "unit_price", Number(e.target.value))}
                      required
                      className="w-28 px-2 py-1.5 text-xs border border-slate-200 rounded text-right bg-white"
                    />
                    <div className="w-24 text-right text-xs font-bold text-slate-700">
                      {formatCurrency(item.amount)}
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove line item ${idx + 1}`}
                      onClick={() => removeLineItem(idx)}
                      disabled={lineItems.length === 1}
                      className="text-slate-400 hover:text-rose-500 disabled:opacity-30 p-1"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Discount and Payment Instructions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="invoices-discount-amount-lkr-5" className="block text-xs font-semibold text-slate-700 mb-1">
                  Discount Amount (LKR)
                </label>
                <input
                  id="invoices-discount-amount-lkr-5"
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <div>
                <label htmlFor="invoices-payment-instructions-6" className="block text-xs font-semibold text-slate-700 mb-1">
                  Payment Instructions
                </label>
                <input
                  id="invoices-payment-instructions-6"
                  type="text"
                  value={paymentInstructions}
                  onChange={(e) => setPaymentInstructions(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>

            {/* Calculation Summary */}
            <div className="bg-purple-50/60 p-4 rounded-xl border border-purple-100 flex justify-between items-center text-sm">
              <div className="space-y-1 text-xs text-slate-600">
                <div>Subtotal: <span className="font-semibold text-slate-800">{formatCurrency(subtotal)}</span></div>
                {discount > 0 && <div>Discount: <span className="font-semibold text-rose-600">-{formatCurrency(discount)}</span></div>}
                {taxAmount > 0 && <div>Tax ({taxRate}%): <span className="font-semibold text-slate-800">{formatCurrency(taxAmount)}</span></div>}
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wider text-purple-700 font-bold">Total Due</div>
                <div className="text-xl font-extrabold text-purple-900">{formatCurrency(grandTotal)}</div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !selectedJobId}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-sm font-semibold transition shadow-sm"
              >
                {submitting ? "Generating..." : "Generate Invoice"}
              </button>
            </div>
          </form>
        </OperationDialog>
      )}
    </div>
  );
}
