"use client";

import Link from "next/link";
import { Briefcase, Clock, AlertTriangle, FileText, CreditCard, ChevronRight } from "lucide-react";
import { STAGE_LABELS, STAGE_COLORS, formatDate } from "@/lib/utils";
import type { Profile, JobStage } from "@/lib/types";

interface Stats {
  activeJobs: number;
  pendingApproval: number;
  overdueJobs: number;
  pendingInvoices: number;
  pendingPayments: number;
}

interface ManagementDashboardProps {
  stats: Stats;
  recentJobs: Array<Record<string, unknown>>;
  profile: Profile;
}

export default function ManagementDashboard({ stats, recentJobs, profile }: ManagementDashboardProps) {
  const statCards = [
    { label: "Active Jobs", value: stats.activeJobs, icon: Briefcase, color: "bg-blue-50 text-blue-700", href: "/jobs" },
    { label: "Pending Approval", value: stats.pendingApproval, icon: Clock, color: "bg-orange-50 text-orange-700", href: "/jobs?stage=READY_FOR_REVIEW" },
    { label: "Overdue", value: stats.overdueJobs, icon: AlertTriangle, color: "bg-red-50 text-red-700", href: "/jobs" },
    { label: "Invoice Needed", value: stats.pendingInvoices, icon: FileText, color: "bg-violet-50 text-violet-700", href: "/invoices" },
    { label: "Payments to Verify", value: stats.pendingPayments, icon: CreditCard, color: "bg-emerald-50 text-emerald-700", href: "/payments" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Good {getGreeting()}, {profile.full_name?.split(" ")[0] || "there"}
        </h1>
        <p className="text-gray-500 text-sm mt-1">Here&apos;s what needs your attention today.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-purple-300 hover:shadow-sm transition-all group"
            >
              <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
                <Icon size={20} />
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500 mt-0.5 group-hover:text-purple-600 transition-colors">
                {card.label}
              </p>
            </Link>
          );
        })}
      </div>

      {/* Recent jobs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Active Jobs</h2>
          <Link href="/jobs" className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1 font-medium">
            View all <ChevronRight size={14} />
          </Link>
        </div>
        <div className="divide-y divide-gray-50">
          {recentJobs.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-400">
              <Briefcase size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No active jobs</p>
            </div>
          ) : (
            recentJobs.map((job: Record<string, unknown>) => {
              const stage = job.current_stage as JobStage;
              const stageColor = STAGE_COLORS[stage] || "bg-gray-100 text-gray-800";
              const stageLabel = STAGE_LABELS[stage] || (job.current_stage as string);
              const client = job.client as Record<string, unknown> | null;

              return (
                <Link
                  key={job.id as string}
                  href={`/jobs/${job.id}`}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{job.title as string}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {(client?.company_name as string) || "Unknown Client"} · {job.job_number as string}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${stageColor}`}>
                      {stageLabel}
                    </span>
                  </div>
                  {job.deadline ? (
                    <p className="text-xs text-gray-400 shrink-0 hidden sm:block">
                      {formatDate(job.deadline as string)}
                    </p>
                  ) : null}
                  <ChevronRight size={16} className="text-gray-300 shrink-0" />
                </Link>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
