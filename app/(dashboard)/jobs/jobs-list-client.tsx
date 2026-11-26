"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, Plus, ChevronRight, Briefcase, AlertTriangle } from "lucide-react";
import { STAGE_LABELS, STAGE_COLORS, formatDate, isOverdue } from "@/lib/utils";
import type { Profile, JobStage } from "@/lib/types";
import CreateJobDialog from "@/components/jobs/create-job-dialog";

interface JobsListClientProps {
  jobs: Array<Record<string, unknown>>;
  clients: Array<{ id: string; company_name: string }>;
  profiles?: Array<{ id: string; full_name: string; role: string }>;
  profile: Profile;
}

const STAGES: JobStage[] = [
  "VISIT_SCHEDULED",
  "VISIT_COMPLETED",
  "BRIEF_CONFIRMED",
  "IN_PRODUCTION",
  "READY_FOR_REVIEW",
  "REVISION_REQUESTED",
  "APPROVED",
  "INVOICE_READY",
  "SENT_TO_CLIENT",
  "PAYMENT_REPORTED",
  "PAYMENT_VERIFIED",
  "COMPLETED",
  "CANCELLED",
];

export default function JobsListClient({ jobs, clients, profiles, profile }: JobsListClientProps) {
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const params = useSearchParams();
  const stage = params.get("stage") as JobStage | null;
  const stageFilter = stage && STAGES.includes(stage) ? stage : "ALL";
  const statusFilter = params.get("overdue") === "1" ? "overdue" : params.get("status") === "active" ? "active" : "all";
  const hasFilters = Boolean(search || stageFilter !== "ALL" || statusFilter !== "all");

  function updateFilters(nextStage: string, nextStatus: string) {
    const url = new URL(window.location.href);
    url.searchParams.delete("stage");
    url.searchParams.delete("overdue");
    url.searchParams.delete("status");
    if (nextStage !== "ALL") url.searchParams.set("stage", nextStage);
    if (nextStatus === "active") url.searchParams.set("status", "active");
    if (nextStatus === "overdue") url.searchParams.set("overdue", "1");
    window.history.replaceState(null, "", url);
  }

  const filtered = useMemo(() => {
    return jobs.filter((job) => {
      const matchSearch =
        search === "" ||
        [
          job.title,
          job.job_number,
          (job.client as Record<string, unknown> | null)?.company_name,
        ].some((v) => String(v || "").toLowerCase().includes(search.toLowerCase()));

      const matchStage = stageFilter === "ALL" || job.current_stage === stageFilter;
      const active = job.current_stage !== "COMPLETED" && job.current_stage !== "CANCELLED";
      const matchStatus = statusFilter === "all" || (active && (statusFilter === "active" || isOverdue(job.deadline as string | null)));
      return matchSearch && matchStage && matchStatus;
    });
  }, [jobs, search, stageFilter, statusFilter]);

  return (
    <div className="operations-module module-jobs">
      {/* Header */}
      <div className="module-heading flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {filtered.length} of {jobs.length} job{jobs.length !== 1 ? "s" : ""}
          </p>
        </div>
        {profile.role === "MANAGEMENT" && (
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <Plus size={16} /> New Job
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="module-toolbar flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search by job title, number, or client"
            placeholder="Search by job title, number, or client..."
            className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
          />
        </div>
        <select
          aria-label="Job stage"
          value={stageFilter}
          onChange={(e) => updateFilters(e.target.value, statusFilter)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white text-gray-700"
        >
          <option value="ALL">All stages</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          aria-label="Job status"
          value={statusFilter}
          onChange={(e) => updateFilters(stageFilter, e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-gray-700"
        >
          <option value="all">All jobs</option>
          <option value="active">Active jobs</option>
          <option value="overdue">Overdue jobs</option>
        </select>
        {hasFilters && (
          <button
            className="module-reset"
            onClick={() => {
              setSearch("");
              updateFilters("ALL", "all");
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Jobs table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Briefcase size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No jobs found</p>
            <p className="text-gray-400 text-sm mt-1">
              {hasFilters
                ? "Try adjusting your search filters"
                : profile.role === "MANAGEMENT" ? "Create a new job to get started" : "Your available jobs will appear here."}
            </p>
          </div>
        ) : (
          <div className="module-table-scroll overflow-x-auto">
            <table className="module-table w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Job
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Stage
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Deadline
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Assigned
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">View</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.map((job: Record<string, unknown>) => {
                  const overdue =
                    isOverdue(job.deadline as string | null) &&
                    !["COMPLETED", "CANCELLED"].includes(job.current_stage as string);
                  const stage = job.current_stage as JobStage;
                  const stageColor = STAGE_COLORS[stage] || "bg-gray-100 text-gray-800";
                  const stageLabel = STAGE_LABELS[stage] || (job.current_stage as string);
                  const client = job.client as Record<string, unknown> | null;
                  const assigned = job.assigned_profile as Record<string, unknown> | null;

                  return (
                    <tr key={job.id as string} className="hover:bg-gray-50 transition-colors">
                      <td data-label="Job" className="px-6 py-4">
                        <div className="flex items-start gap-2">
                          {overdue && <AlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />}
                          <div className="min-w-0">
                            <Link
                              href={`/jobs/${job.id}`}
                              className="text-sm font-medium text-gray-900 hover:text-purple-600 transition-colors block truncate"
                            >
                              {job.title as string}
                            </Link>
                            <p className="text-xs text-gray-500 truncate">
                              {(client?.company_name as string) || "Client"} · {job.job_number as string}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td data-label="Type" className="px-6 py-4 hidden md:table-cell">
                        <span className="text-sm text-gray-600">{job.job_type as string}</span>
                      </td>
                      <td data-label="Stage" className="px-6 py-4">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stageColor}`}>
                          {stageLabel}
                        </span>
                      </td>
                      <td data-label="Deadline" className="px-6 py-4 hidden lg:table-cell">
                        <span className={`text-sm ${overdue ? "text-red-600 font-semibold" : "text-gray-500"}`}>
                          {formatDate(job.deadline as string | null) || "—"}
                        </span>
                      </td>
                      <td data-label="Assigned" className="px-6 py-4 hidden lg:table-cell">
                        <span className="text-sm text-gray-600">
                          {(assigned?.full_name as string) || "Unassigned"}
                        </span>
                      </td>
                      <td data-label="View" className="px-6 py-4 text-right">
                        <Link
                          href={`/jobs/${job.id}`}
                          className="text-purple-600 hover:text-purple-700 inline-flex items-center gap-1 text-sm font-medium"
                        >
                          View <ChevronRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {createOpen && (
        <CreateJobDialog
          clients={clients}
          profiles={profiles}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
