"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  User,
  Phone,
  Mail,
  MapPin,
  FileText,
  Plus,
  Search,
  ExternalLink,
  Briefcase,
  Loader2,
  X,
  MessageSquare,
  CheckCircle2,
  LayoutGrid,
  Table as TableIcon,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { formatSriLankanPhone } from "@/lib/utils";
import type { Client, Profile } from "@/lib/types";
import { toast } from "sonner";

export interface ClientWithStats extends Client {
  active_jobs_count?: number;
  total_jobs_count?: number;
}

interface ClientsClientProps {
  initialClients: ClientWithStats[];
  userProfile: Profile;
}

export default function ClientsClient({
  initialClients,
  userProfile,
}: ClientsClientProps) {
  const router = useRouter();
  const [clients, setClients] = useState<ClientWithStats[]>(initialClients);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "table">("grid");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deleteConfirmClient, setDeleteConfirmClient] = useState<ClientWithStats | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDeleteClient() {
    if (!deleteConfirmClient) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/clients/${deleteConfirmClient.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to remove client");

      if (json.action === "DEACTIVATED") {
        toast.info(json.message);
        setClients((prev) =>
          prev.map((c) =>
            c.id === deleteConfirmClient.id ? { ...c, is_active: false } : c
          )
        );
      } else {
        toast.success(json.message || "Client removed successfully");
        setClients((prev) => prev.filter((c) => c.id !== deleteConfirmClient.id));
      }
      setDeleteConfirmClient(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error deleting client");
    } finally {
      setIsDeleting(false);
    }
  }

  // Management and Marketing can add clients
  const canAddClient = ["MANAGEMENT", "MARKETING_CUSTOMER_CARE"].includes(
    userProfile.role
  );

  const filteredClients = clients.filter((c) => {
    const q = search.toLowerCase();
    const matchesSearch =
      c.company_name.toLowerCase().includes(q) ||
      c.contact_name.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.includes(q)) ||
      (c.whatsapp_number && c.whatsapp_number.includes(q));

    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && c.is_active) ||
      (statusFilter === "INACTIVE" && !c.is_active);

    return matchesSearch && matchesStatus;
  });

  const totalClients = clients.length;
  const activeClients = clients.filter((c) => c.is_active).length;
  const withActiveJobs = clients.filter((c) => (c.active_jobs_count || 0) > 0).length;

  // Add client form handler
  async function handleAddClient(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = e.currentTarget;
    const formData = new FormData(form);

    const payload = {
      company_name: formData.get("company_name") as string,
      contact_name: formData.get("contact_name") as string,
      phone: (formData.get("phone") as string) || undefined,
      whatsapp_number: (formData.get("whatsapp_number") as string) || undefined,
      email: (formData.get("email") as string) || undefined,
      billing_address: (formData.get("billing_address") as string) || undefined,
      tax_registration: (formData.get("tax_registration") as string) || undefined,
      notes: (formData.get("notes") as string) || undefined,
    };

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error || "Failed to create client");
      }

      toast.success("Client registered successfully!");
      setIsAddOpen(false);
      setClients((prev) => [
        { ...resData.data, active_jobs_count: 0, total_jobs_count: 0 },
        ...prev,
      ]);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create client");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Clients Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Directory of corporate accounts, contacts, job history, and billing records.
          </p>
        </div>

        {canAddClient && (
          <button
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
          >
            <Plus size={16} />
            New Client
          </button>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
            <Building2 size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Total Clients
            </p>
            <p className="text-2xl font-bold text-slate-900">{totalClients}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Active Accounts
            </p>
            <p className="text-2xl font-bold text-slate-900">{activeClients}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <Briefcase size={24} />
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              With Ongoing Jobs
            </p>
            <p className="text-2xl font-bold text-slate-900">{withActiveJobs}</p>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by company, contact, phone, or email..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "ALL" | "ACTIVE" | "INACTIVE")}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center border border-slate-200 rounded-lg p-0.5 bg-slate-50">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "grid"
                  ? "bg-white text-purple-600 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              title="Grid View"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === "table"
                  ? "bg-white text-purple-600 shadow-sm"
                  : "text-slate-400 hover:text-slate-600"
              }`}
              title="Table View"
            >
              <TableIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredClients.length === 0 ? (
            <div className="col-span-full bg-white p-12 text-center text-slate-400 rounded-xl border border-slate-200">
              No clients found matching the search criteria.
            </div>
          ) : (
            filteredClients.map((client) => {
              const waDigits = client.whatsapp_number
                ? client.whatsapp_number.replace(/\D/g, "")
                : null;

              return (
                <div
                  key={client.id}
                  className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <Link
                          href={`/clients/${client.id}`}
                          className="font-semibold text-slate-900 text-base hover:text-purple-600 transition-colors line-clamp-1"
                        >
                          {client.company_name}
                        </Link>
                        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <User size={12} />
                          {client.contact_name}
                        </p>
                      </div>

                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          client.is_active
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {client.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs text-slate-600 my-4 border-t border-b border-slate-100 py-3">
                      {client.email && (
                        <div className="flex items-center gap-2">
                          <Mail size={13} className="text-slate-400 shrink-0" />
                          <a
                            href={`mailto:${client.email}`}
                            className="hover:underline truncate"
                          >
                            {client.email}
                          </a>
                        </div>
                      )}

                      {client.phone && (
                        <div className="flex items-center gap-2">
                          <Phone size={13} className="text-slate-400 shrink-0" />
                          <a href={`tel:${client.phone}`} className="hover:underline">
                            {client.phone}
                          </a>
                        </div>
                      )}

                      {client.whatsapp_number && (
                        <div className="flex items-center gap-2 text-emerald-600">
                          <MessageSquare size={13} className="shrink-0" />
                          <a
                            href={`https://wa.me/${waDigits}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:underline font-medium"
                          >
                            {formatSriLankanPhone(client.whatsapp_number)}
                          </a>
                        </div>
                      )}

                      {client.billing_address && (
                        <div className="flex items-start gap-2">
                          <MapPin size={13} className="text-slate-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-1 text-slate-500">
                            {client.billing_address}
                          </span>
                        </div>
                      )}

                      {client.tax_registration && (
                        <div className="flex items-center gap-2 text-slate-500">
                          <FileText size={13} className="text-slate-400 shrink-0" />
                          <span>Tax: {client.tax_registration}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Footer actions */}
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                      <Briefcase size={12} className="text-purple-600" />
                      {client.active_jobs_count || 0} active jobs
                    </span>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/jobs?client_id=${client.id}`}
                        className="text-xs font-medium text-slate-600 hover:text-purple-600 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                      >
                        Jobs
                      </Link>
                      <Link
                        href={`/clients/${client.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 px-2.5 py-1.5 rounded-lg transition-colors"
                      >
                        Profile
                        <ExternalLink size={12} />
                      </Link>
                      {userProfile.role === "MANAGEMENT" && (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmClient(client)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Remove Client"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-3.5">Company</th>
                  <th className="px-6 py-3.5">Contact Person</th>
                  <th className="px-6 py-3.5">Contact Details</th>
                  <th className="px-6 py-3.5">Active Jobs</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      No clients found matching the search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client) => {
                    const waDigits = client.whatsapp_number
                      ? client.whatsapp_number.replace(/\D/g, "")
                      : null;

                    return (
                      <tr key={client.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-4">
                          <Link
                            href={`/clients/${client.id}`}
                            className="font-semibold text-slate-900 hover:text-purple-600 transition-colors"
                          >
                            {client.company_name}
                          </Link>
                          {client.tax_registration && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              TIN: {client.tax_registration}
                            </p>
                          )}
                        </td>

                        <td className="px-6 py-4 text-slate-700">
                          {client.contact_name}
                        </td>

                        <td className="px-6 py-4">
                          <div className="space-y-1 text-xs">
                            {client.email && (
                              <p className="text-slate-600">{client.email}</p>
                            )}
                            {client.whatsapp_number && (
                              <a
                                href={`https://wa.me/${waDigits}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-600 hover:underline font-medium inline-block"
                              >
                                WA: {formatSriLankanPhone(client.whatsapp_number)}
                              </a>
                            )}
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                            <Briefcase size={11} />
                            {client.active_jobs_count || 0} active
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              client.is_active
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {client.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/jobs?client_id=${client.id}`}
                              className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-purple-600 hover:bg-purple-50 rounded-lg border border-slate-200 transition-colors"
                            >
                              Jobs
                            </Link>
                            <Link
                              href={`/clients/${client.id}`}
                              className="px-2.5 py-1 text-xs font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                            >
                              View Details
                            </Link>
                            {userProfile.role === "MANAGEMENT" && (
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmClient(client)}
                                className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remove Client"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Client Creation Dialog Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div>
                <h2 className="font-semibold text-slate-900">Add New Client</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Register a corporate client for project tracking & billing
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddClient} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Company Name *
                  </label>
                  <input
                    name="company_name"
                    required
                    placeholder="e.g. Ceylon Tea Exports Ltd"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Primary Contact Person *
                  </label>
                  <input
                    name="contact_name"
                    required
                    placeholder="e.g. Priyantha Silva"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    name="phone"
                    placeholder="011 234 5678"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    WhatsApp Number
                  </label>
                  <input
                    name="whatsapp_number"
                    placeholder="+94 77 123 4567"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    name="email"
                    type="email"
                    placeholder="billing@ceylontea.lk"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Billing Address
                  </label>
                  <input
                    name="billing_address"
                    placeholder="e.g. No. 45 Galle Road, Colombo 03"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Tax / VAT Registration No.
                  </label>
                  <input
                    name="tax_registration"
                    placeholder="e.g. 102938475-7000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    rows={2}
                    placeholder="Key account details, preferred communication channel..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  disabled={loading}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Registering...
                    </>
                  ) : (
                    "Register Client"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Deactivate Confirmation Dialog */}
      {deleteConfirmClient && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-600 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900">Remove Client</h3>
                <p className="text-xs text-slate-500">{deleteConfirmClient.company_name}</p>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              {deleteConfirmClient.active_jobs_count && deleteConfirmClient.active_jobs_count > 0
                ? "This client has linked job records. Deactivating will preserve all past job & invoice records while hiding the client from active operations."
                : "Are you sure you want to remove this client? This client has no linked jobs and will be permanently deleted."}
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmClient(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteClient}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center justify-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 size={15} />
                    Confirm Remove
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
