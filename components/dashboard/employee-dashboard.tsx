"use client";

import Link from "next/link";
import { Briefcase, Bell, ChevronRight, Calendar, AlertCircle } from "lucide-react";
import { STAGE_LABELS, STAGE_COLORS, formatDate, ROLE_LABELS } from "@/lib/utils";
import type { Profile, JobStage } from "@/lib/types";

interface EmployeeDashboardProps {
  profile: Profile;
  assignedJobs: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
}

export default function EmployeeDashboard({ profile, assignedJobs, notifications }: EmployeeDashboardProps) {
  const jobsNeedingAction = assignedJobs.filter((j) =>
    !["READY_FOR_REVIEW", "APPROVED", "CANCELLED", "COMPLETED"].includes(j.current_stage as string)
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, {profile.full_name?.split(" ")[0] || "Team Member"}
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          {ROLE_LABELS[profile.role]} · {assignedJobs.length} active assignment{assignedJobs.length !== 1 ? "s" : ""}
          {jobsNeedingAction.length > 0 && ` (${jobsNeedingAction.length} in progress)`}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assigned jobs */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Briefcase size={18} className="text-purple-600" />
              My Jobs ({assignedJobs.length})
            </h2>
            <Link href="/jobs" className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1 font-medium">
              View all <ChevronRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {assignedJobs.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400">
                <Briefcase size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No active assignments</p>
              </div>
            ) : (
              assignedJobs.slice(0, 6).map((job: Record<string, unknown>) => {
                const stage = job.current_stage as JobStage;
                const stageColor = STAGE_COLORS[stage] || "bg-gray-100 text-gray-800";
                const stageLabel = STAGE_LABELS[stage] || (job.current_stage as string);
                const client = job.client as Record<string, unknown> | null;

                return (
                  <Link
                    key={job.id as string}
                    href={`/jobs/${job.id}`}
                    className="flex items-center gap-3 px-6 py-3.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{job.title as string}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {(client?.company_name as string) || "Client"} · {job.job_number as string}
                      </p>
                    </div>
                    {job.deadline ? (
                      <span className="text-xs text-gray-400 shrink-0 hidden sm:block">
                        {formatDate(job.deadline as string)}
                      </span>
                    ) : null}
                    <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stageColor}`}>
                      {stageLabel}
                    </span>
                    <ChevronRight size={14} className="text-gray-300 shrink-0" />
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Bell size={18} className="text-purple-600" />
              Recent Notifications
            </h2>
            <Link href="/notifications" className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1 font-medium">
              View all <ChevronRight size={14} />
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {notifications.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-400">
                <Bell size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No new notifications</p>
              </div>
            ) : (
              notifications.map((notif: Record<string, unknown>) => (
                <div key={notif.id as string} className="px-6 py-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900">{notif.title as string}</p>
                    {notif.created_at ? (
                      <span className="text-[11px] text-gray-400 shrink-0">
                        {formatDate(notif.created_at as string)}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.body as string}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
