"use client";

import OperationDialog from "@/app/(dashboard)/_components/operation-dialog";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X, Plus, Loader2, UserPlus } from "lucide-react";
import { JOB_TYPES, ROLE_LABELS } from "@/lib/utils";
import type { UserRole } from "@/lib/types";
import { toast } from "sonner";

const schema = z.object({
  title: z.string().min(1, "Job title is required"),
  job_type: z.string().min(1, "Job type is required"),
  client_id: z.string().optional(),
  assigned_to: z.string().optional(),
  visit_date: z.string().optional(),
  visit_location: z.string().optional(),
  brief: z.string().optional(),
  deadline: z.string().optional(),
  agreed_price: z.string().optional(),
});

type FormData = z.infer<typeof schema>;

interface CreateJobDialogProps {
  clients: Array<{ id: string; company_name: string }>;
  profiles?: Array<{ id: string; full_name: string; role: string }>;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateJobDialog({
  clients: initialClients,
  profiles: initialProfiles,
  onClose,
  onCreated,
}: CreateJobDialogProps) {
  const [loading, setLoading] = useState(false);
  const [clientsList, setClientsList] = useState(initialClients);
  const [profiles, setProfiles] = useState<
    Array<{ id: string; full_name: string; role: string }>
  >(initialProfiles || []);

  // New Client inline toggle and state
  const [isNewClient, setIsNewClient] = useState(false);
  const [newClient, setNewClient] = useState({
    company_name: "",
    contact_name: "",
    phone: "",
    whatsapp_number: "",
    email: "",
    billing_address: "",
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      job_type: "Graphic Design",
      client_id: "",
      assigned_to: "",
      title: "",
      visit_date: "",
      visit_location: "",
      brief: "",
      deadline: "",
      agreed_price: "",
    },
  });

  const selectedClientId = watch("client_id");

  // Fetch active team profiles if not passed in
  useEffect(() => {
    if (!initialProfiles || initialProfiles.length === 0) {
      fetch("/api/employees")
        .then((r) => r.json())
        .then((res) => {
          if (res.data) setProfiles(res.data);
        })
        .catch(() => {});
    }
  }, [initialProfiles]);

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      let resolvedClientId = data.client_id;

      // 1. If user chose "+ Add New Client", create the client first
      if (isNewClient) {
        if (!newClient.company_name.trim() || !newClient.contact_name.trim()) {
          toast.error("Please fill in Company Name and Contact Person for the new client");
          setLoading(false);
          return;
        }

        const clientRes = await fetch("/api/clients", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_name: newClient.company_name.trim(),
            contact_name: newClient.contact_name.trim(),
            phone: newClient.phone.trim() || undefined,
            whatsapp_number:
              newClient.whatsapp_number.trim() || newClient.phone.trim() || undefined,
            email: newClient.email.trim() || undefined,
            billing_address: newClient.billing_address.trim() || undefined,
          }),
        });

        if (!clientRes.ok) {
          const err = await clientRes.json().catch(() => ({}));
          throw new Error(err.error || "Failed to register new client");
        }

        const clientJson = await clientRes.json();
        const createdClient = clientJson.data;
        resolvedClientId = createdClient.id;

        // Add to local clientsList so it's instantly available
        setClientsList((prev) => [...prev, createdClient]);
      } else {
        if (!resolvedClientId) {
          toast.error("Please select an existing client or choose '+ Add New Client...'");
          setLoading(false);
          return;
        }
      }

      // 2. Create the Job linked to the resolved client ID
      const payload: Record<string, unknown> = {
        title: data.title.trim(),
        job_type: data.job_type,
        client_id: resolvedClientId,
        brief: data.brief?.trim() || undefined,
        visit_location: data.visit_location?.trim() || undefined,
      };

      if (data.assigned_to && data.assigned_to.trim()) {
        payload.assigned_to = data.assigned_to;
      }

      if (data.agreed_price && parseFloat(data.agreed_price) > 0) {
        payload.agreed_price = parseFloat(data.agreed_price);
      }

      if (data.visit_date) {
        payload.visit_date = new Date(data.visit_date).toISOString();
      }

      if (data.deadline) {
        payload.deadline = new Date(data.deadline).toISOString();
      }

      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to create job");
      }

      toast.success(
        isNewClient
          ? "New client registered & job created successfully!"
          : "Job created successfully!"
      );
      onCreated();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create job");
    } finally {
      setLoading(false);
    }
  }

  return (
    <OperationDialog titleId="new-job-dialog" onDismiss={onClose} className="w-full max-w-lg">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h2 id="new-job-dialog" className="font-semibold text-gray-900">New job</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Schedule a client visit and create a job record
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
        {/* Client Selection / Inline Creation */}
        <div>
          <label htmlFor="new-job-client-1" className="block text-sm font-medium text-gray-700 mb-1">
            Client *
          </label>
          <select
            id="new-job-client-1"
            value={isNewClient ? "__NEW_CLIENT__" : selectedClientId}
            onChange={(e) => {
              const val = e.target.value;
              if (val === "__NEW_CLIENT__") {
                setIsNewClient(true);
                setValue("client_id", "");
              } else {
                setIsNewClient(false);
                setValue("client_id", val);
              }
            }}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
          >
            <option value="">Select a client...</option>
            <option
              value="__NEW_CLIENT__"
              className="text-purple-700 font-semibold bg-purple-50"
            >
              Add a new client…
            </option>
            {clientsList.length > 0 && (
              <optgroup label="Existing Clients">
                {clientsList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company_name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        {/* Inline New Client Fields */}
        {isNewClient && (
          <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-800 flex items-center gap-1.5">
                <UserPlus size={14} />
                New Client Information
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsNewClient(false);
                  setValue("client_id", "");
                }}
                className="text-xs text-purple-700 hover:text-purple-900 underline font-medium"
              >
                Choose existing client
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <label htmlFor="new-job-company-name-2" className="block text-xs font-medium text-slate-700 mb-1">
                  Company Name *
                </label>
                <input
                  id="new-job-company-name-2"
                  value={newClient.company_name}
                  onChange={(e) =>
                    setNewClient({ ...newClient, company_name: e.target.value })
                  }
                  placeholder="e.g. Acme Marketing PVT Ltd"
                  className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required={isNewClient}
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="new-job-primary-contact-person-3" className="block text-xs font-medium text-slate-700 mb-1">
                  Primary Contact Person *
                </label>
                <input
                  id="new-job-primary-contact-person-3"
                  value={newClient.contact_name}
                  onChange={(e) =>
                    setNewClient({ ...newClient, contact_name: e.target.value })
                  }
                  placeholder="e.g. Kasun Fernando"
                  className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required={isNewClient}
                />
              </div>

              <div>
                <label htmlFor="new-job-phone-number-4" className="block text-xs font-medium text-slate-700 mb-1">
                  Phone Number
                </label>
                <input
                  id="new-job-phone-number-4"
                  value={newClient.phone}
                  onChange={(e) =>
                    setNewClient({ ...newClient, phone: e.target.value })
                  }
                  placeholder="077 123 4567"
                  className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label htmlFor="new-job-whatsapp-number-5" className="block text-xs font-medium text-slate-700 mb-1">
                  WhatsApp Number
                </label>
                <input
                  id="new-job-whatsapp-number-5"
                  value={newClient.whatsapp_number}
                  onChange={(e) =>
                    setNewClient({
                      ...newClient,
                      whatsapp_number: e.target.value,
                    })
                  }
                  placeholder="+94 77 123 4567"
                  className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="new-job-email-address-optional-6" className="block text-xs font-medium text-slate-700 mb-1">
                  Email Address (Optional)
                </label>
                <input
                  id="new-job-email-address-optional-6"
                  type="email"
                  value={newClient.email}
                  onChange={(e) =>
                    setNewClient({ ...newClient, email: e.target.value })
                  }
                  placeholder="contact@acme.example.lk"
                  className="w-full px-3 py-2 border border-purple-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          </div>
        )}

        <div>
          <label htmlFor="new-job-job-title-7" className="block text-sm font-medium text-gray-700 mb-1">
            Job Title *
          </label>
          <input
            id="new-job-job-title-7"
            {...register("title")}
            placeholder="e.g. November social media campaign"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
          {errors.title && (
            <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="new-job-job-type-8" className="block text-sm font-medium text-gray-700 mb-1">
              Job Type *
            </label>
            <select
              id="new-job-job-type-8"
              {...register("job_type")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            >
              {JOB_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="new-job-agreed-price-lkr-9" className="block text-sm font-medium text-gray-700 mb-1">
              Agreed Price (LKR)
            </label>
            <input
              id="new-job-agreed-price-lkr-9"
              {...register("agreed_price")}
              type="number"
              placeholder="85000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        {profiles.length > 0 && (
          <div>
            <label htmlFor="new-job-assign-to-10" className="block text-sm font-medium text-gray-700 mb-1">
              Assign To
            </label>
            <select
              id="new-job-assign-to-10"
              {...register("assigned_to")}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
            >
              <option value="">Unassigned</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.full_name} ({ROLE_LABELS[p.role as UserRole] || p.role})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="new-job-visit-date-11" className="block text-sm font-medium text-gray-700 mb-1">
              Visit Date
            </label>
            <input
              id="new-job-visit-date-11"
              {...register("visit_date")}
              type="datetime-local"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label htmlFor="new-job-deadline-12" className="block text-sm font-medium text-gray-700 mb-1">
              Deadline
            </label>
            <input
              id="new-job-deadline-12"
              {...register("deadline")}
              type="datetime-local"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>

        <div>
          <label htmlFor="new-job-visit-location-13" className="block text-sm font-medium text-gray-700 mb-1">
            Visit Location
          </label>
          <input
            id="new-job-visit-location-13"
            {...register("visit_location")}
            placeholder="e.g. Colombo 03 / Online"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        <div>
          <label htmlFor="new-job-brief-notes-14" className="block text-sm font-medium text-gray-700 mb-1">
            Brief / Notes
          </label>
          <textarea
            id="new-job-brief-notes-14"
            {...register("brief")}
            rows={3}
            placeholder="Describe the client's requirements..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
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
                Creating...
              </>
            ) : (
              <>
                <Plus size={16} />
                Create Job
              </>
            )}
          </button>
        </div>
      </form>
    </OperationDialog>
  );
}
