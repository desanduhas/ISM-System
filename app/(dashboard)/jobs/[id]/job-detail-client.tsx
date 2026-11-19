"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  User,
  Phone,
  MessageCircle,
  FileText,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Clock3,
  ExternalLink,
  Send,
  Loader2,
  File,
  Image as ImageIcon,
  Video,
  Download,
  AlertTriangle,
  ChevronRight,
  ShieldAlert,
  Building,
} from "lucide-react";
import { canTransition, getAvailableTransitions } from "@/lib/auth/role-guard";
import {
  STAGE_LABELS,
  STAGE_COLORS,
  formatDate,
  formatDateTime,
  formatCurrency,
  isOverdue,
  ROLE_LABELS,
} from "@/lib/utils";
import type { Profile, JobStage, UserRole } from "@/lib/types";
import { toast } from "sonner";

interface JobDetailClientProps {
  job: Record<string, unknown>;
  profile: Profile;
  allProfiles: Array<{ id: string; full_name: string; role: string }>;
}

export default function JobDetailClient({
  job: initialJob,
  profile,
  allProfiles,
}: JobDetailClientProps) {
  const router = useRouter();
  const [job, setJob] = useState(initialJob);
  const [activeTab, setActiveTab] = useState<"overview" | "files" | "activity" | "finance">("overview");

  // Stage transition states
  const [transitioning, setTransitioning] = useState(false);
  const [dialogAction, setDialogAction] = useState<"revision" | "cancel" | null>(null);
  const [actionNotes, setActionNotes] = useState("");

  // Comment state
  const [commentText, setCommentText] = useState("");
  const [isInternalComment, setIsInternalComment] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  const currentStage = job.current_stage as JobStage;
  const client = (job.client || {}) as Record<string, unknown>;
  const assigned = (job.assigned_profile || null) as Record<string, unknown> | null;
  const department = (job.department || null) as Record<string, unknown> | null;
  const history = (job.job_stage_history || []) as Array<Record<string, unknown>>;
  const comments = (job.job_comments || []) as Array<Record<string, unknown>>;
  const attachments = (job.job_attachments || []) as Array<Record<string, unknown>>;
  const approvals = (job.job_approvals || []) as Array<Record<string, unknown>>;
  const invoices = (job.invoices || []) as Array<Record<string, unknown>>;
  const payments = (job.payments || []) as Array<Record<string, unknown>>;

  const overdue =
    isOverdue(job.deadline as string | null) &&
    !["COMPLETED", "CANCELLED"].includes(currentStage);

  const availableTransitions = getAvailableTransitions(profile.role, currentStage);

  // Transition handler
  async function handleTransition(toStage: JobStage, notes?: string) {
    setTransitioning(true);
    try {
      const payload: Record<string, unknown> = {
        to_stage: toStage,
      };

      if (toStage === "REVISION_REQUESTED") {
        if (!notes?.trim()) {
          toast.error("Please enter revision notes for the team");
          setTransitioning(false);
          return;
        }
        payload.revision_notes = notes;
      }

      if (toStage === "CANCELLED") {
        if (!notes?.trim()) {
          toast.error("Please enter a reason for cancellation");
          setTransitioning(false);
          return;
        }
        payload.reason = notes;
      }

      const res = await fetch(`/api/jobs/${job.id}/stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update job stage");
      }

      toast.success(`Job stage updated to ${STAGE_LABELS[toStage]}`);
      setDialogAction(null);
      setActionNotes("");
      router.refresh();
      // Update local state
      setJob((prev) => ({
        ...prev,
        current_stage: toStage,
        job_stage_history: [
          ...(prev.job_stage_history as Array<Record<string, unknown>>),
          {
            id: `temp-${Date.now()}`,
            from_stage: currentStage,
            to_stage: toStage,
            changed_by_profile: { full_name: profile.full_name },
            created_at: new Date().toISOString(),
            reason: notes || null,
          },
        ],
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error transitioning stage");
    } finally {
      setTransitioning(false);
    }
  }

  // Comment submission
  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    try {
      const res = await fetch(`/api/jobs/${job.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: commentText.trim(),
          is_internal: isInternalComment,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to add comment");
      }

      toast.success("Comment added");
      setCommentText("");
      // Update local state
      setJob((prev) => ({
        ...prev,
        job_comments: [...(prev.job_comments as Array<Record<string, unknown>>), data.data],
      }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setSubmittingComment(false);
    }
  }

  // Helper for file type icons
  function getFileIcon(mime: string | null, type: string) {
    if (type === "raw" || mime?.startsWith("image/")) return <ImageIcon size={20} className="text-blue-500" />;
    if (mime?.startsWith("video/")) return <Video size={20} className="text-purple-500" />;
    return <File size={20} className="text-gray-500" />;
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Bar with Back and Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <Link
            href="/jobs"
            className="p-2 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                {job.job_number as string}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[currentStage]}`}>
                {STAGE_LABELS[currentStage]}
              </span>
              {overdue && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                  <AlertTriangle size={12} /> Overdue
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">{job.title as string}</h1>
          </div>
        </div>

        {/* Action Controls & Transitions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Management review buttons */}
          {profile.role === "MANAGEMENT" && currentStage === "READY_FOR_REVIEW" && (
            <>
              <button
                onClick={() => setDialogAction("revision")}
                disabled={transitioning}
                className="px-3.5 py-2 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5"
              >
                <AlertCircle size={16} /> Request Revision
              </button>
              <button
                onClick={() => handleTransition("APPROVED")}
                disabled={transitioning}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 size={16} /> Approve Work
              </button>
            </>
          )}

          {/* Regular role transitions */}
          {availableTransitions
            .filter((s) => !(currentStage === "READY_FOR_REVIEW" && ["APPROVED", "REVISION_REQUESTED"].includes(s)))
            .map((nextStage) => {
              if (nextStage === "CANCELLED") {
                return (
                  <button
                    key={nextStage}
                    onClick={() => setDialogAction("cancel")}
                    disabled={transitioning}
                    className="px-3 py-2 border border-gray-300 hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-medium transition-colors"
                  >
                    Cancel Job
                  </button>
                );
              }

              return (
                <button
                  key={nextStage}
                  onClick={() => handleTransition(nextStage)}
                  disabled={transitioning}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center gap-1.5 shadow-sm"
                >
                  {transitioning ? <Loader2 size={16} className="animate-spin" /> : null}
                  Move to {STAGE_LABELS[nextStage]}
                </button>
              );
            })}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          <button
            onClick={() => setActiveTab("overview")}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === "overview"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab("files")}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
              activeTab === "files"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Files & Approvals
            {attachments.length > 0 && (
              <span className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">
                {attachments.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("activity")}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
              activeTab === "activity"
                ? "border-purple-600 text-purple-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Activity & Comments
            {comments.length > 0 && (
              <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full">
                {comments.length}
              </span>
            )}
          </button>
          {(profile.role === "MANAGEMENT" || profile.role === "FINANCE") && (
            <button
              onClick={() => setActiveTab("finance")}
              className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors flex items-center gap-2 ${
                activeTab === "finance"
                  ? "border-purple-600 text-purple-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              Finance
              {invoices.length > 0 && (
                <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-0.5 rounded-full">
                  {invoices.length}
                </span>
              )}
            </button>
          )}
        </nav>
      </div>

      {/* TAB CONTENT */}

      {/* 1. OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Brief and Scope */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Job Brief & Description</h2>
              {job.brief ? (
                <p className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">
                  {job.brief as string}
                </p>
              ) : (
                <p className="text-gray-400 text-sm italic">No specific brief entered for this job.</p>
              )}
            </div>

            {/* Visit Details */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin size={18} className="text-purple-600" /> Visit & Schedule Details
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Visit Date & Time</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {formatDateTime(job.visit_date as string | null) || "Not scheduled"}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">Visit Location</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {(job.visit_location as string) || "Not specified"}
                  </p>
                </div>
                {job.visit_notes ? (
                  <div className="p-3 bg-gray-50 rounded-lg sm:col-span-2">
                    <p className="text-xs text-gray-500">Visit Notes</p>
                    <p className="text-sm text-gray-700 mt-1">{job.visit_notes as string}</p>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Stage Progress Summary */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900 mb-3">Current Status</h2>
              <div className="flex items-center gap-3 p-4 bg-purple-50 rounded-xl border border-purple-100">
                <Clock3 size={24} className="text-purple-600 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-purple-950">
                    Stage: {STAGE_LABELS[currentStage]}
                  </p>
                  <p className="text-xs text-purple-700 mt-0.5">
                    {currentStage === "READY_FOR_REVIEW"
                      ? "Awaiting Management approval."
                      : currentStage === "APPROVED"
                      ? "Approved by Management. Ready for finance invoice creation."
                      : currentStage === "COMPLETED"
                      ? "Job has been completed and verified."
                      : `In progress under ${STAGE_LABELS[currentStage]}.`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Meta details */}
          <div className="space-y-6">
            {/* Client Card */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Building size={18} className="text-purple-600" /> Client Information
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Company</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {(client.company_name as string) || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Contact Person</p>
                  <p className="text-sm text-gray-800">{(client.contact_name as string) || "—"}</p>
                </div>
                {client.phone ? (
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <a
                      href={`tel:${client.phone}`}
                      className="text-sm text-purple-600 hover:underline flex items-center gap-1 mt-0.5"
                    >
                      <Phone size={14} /> {client.phone as string}
                    </a>
                  </div>
                ) : null}
                {client.whatsapp_number ? (
                  <div>
                    <p className="text-xs text-gray-500">WhatsApp</p>
                    <a
                      href={`https://wa.me/${String(client.whatsapp_number).replace(/\D/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-emerald-600 hover:underline flex items-center gap-1 mt-0.5"
                    >
                      <MessageCircle size={14} /> {client.whatsapp_number as string}
                    </a>
                  </div>
                ) : null}
                {client.billing_address ? (
                  <div>
                    <p className="text-xs text-gray-500">Billing Address</p>
                    <p className="text-xs text-gray-700 mt-0.5 leading-relaxed">
                      {client.billing_address as string}
                    </p>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Assignment & Deadline */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <User size={18} className="text-purple-600" /> Assignment & Schedule
              </h2>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500">Assigned Team Member</p>
                  <p className="text-sm font-medium text-gray-900 mt-0.5">
                    {(assigned?.full_name as string) || "Unassigned"}
                  </p>
                  {assigned?.role ? (
                    <p className="text-xs text-gray-500">
                      {ROLE_LABELS[assigned.role as UserRole] || (assigned.role as string)}
                    </p>
                  ) : null}
                </div>
                {department ? (
                  <div>
                    <p className="text-xs text-gray-500">Department</p>
                    <p className="text-sm text-gray-800">{department.name as string}</p>
                  </div>
                ) : null}
                <div>
                  <p className="text-xs text-gray-500">Deadline</p>
                  <p className={`text-sm font-medium mt-0.5 ${overdue ? "text-red-600 font-semibold" : "text-gray-900"}`}>
                    {formatDate(job.deadline as string | null) || "No deadline set"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Agreed Price</p>
                  <p className="text-base font-bold text-gray-900 mt-0.5">
                    {job.agreed_price ? formatCurrency(job.agreed_price as number) : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. FILES & APPROVALS TAB */}
      {activeTab === "files" && (
        <div className="space-y-6">
          {/* Attachments Section */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Job Files & Attachments</h2>
                <p className="text-xs text-gray-500 mt-0.5">Production assets, artwork, and client materials</p>
              </div>
            </div>

            {attachments.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FileText size={36} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm font-medium">No files attached yet</p>
                <p className="text-xs text-gray-400 mt-1">Uploaded files and drive links will appear here.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {attachments.map((file) => {
                  const uploader = (file.uploader || null) as Record<string, unknown> | null;
                  return (
                    <div
                      key={file.id as string}
                      className="p-4 border border-gray-200 rounded-xl hover:border-purple-300 transition-colors flex items-start gap-3 bg-white"
                    >
                      <div className="p-2 rounded-lg bg-gray-50 shrink-0">
                        {getFileIcon(file.mime_type as string | null, file.file_type as string)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.file_name as string}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Uploaded by {(uploader?.full_name as string) || "Team"} ·{" "}
                          {formatDate(file.created_at as string)}
                        </p>
                        {file.drive_link ? (
                          <a
                            href={file.drive_link as string}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 mt-2 font-medium"
                          >
                            Open Drive Link <ExternalLink size={12} />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Approvals History */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Management Approvals & Reviews</h2>
            {approvals.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 italic">No review records recorded yet.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {approvals.map((app) => {
                  const reviewer = (app.reviewer || null) as Record<string, unknown> | null;
                  const isApproved = app.decision === "APPROVED";
                  return (
                    <div key={app.id as string} className="py-3 flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                              isApproved ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                            }`}
                          >
                            {app.decision as string}
                          </span>
                          <span className="text-xs text-gray-500">
                            by {(reviewer?.full_name as string) || "Management"}
                          </span>
                        </div>
                        {app.revision_notes ? (
                          <p className="text-sm text-gray-700 mt-1 bg-gray-50 p-2.5 rounded-lg border border-gray-100">
                            {app.revision_notes as string}
                          </p>
                        ) : null}
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">
                        {formatDateTime(app.created_at as string)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. ACTIVITY & COMMENTS TAB */}
      {activeTab === "activity" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Stage History Timeline */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Stage History Timeline</h2>
            {history.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 italic">No history logged yet.</p>
            ) : (
              <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
                {history.map((step) => {
                  const changedBy = (step.changed_by_profile || null) as Record<string, unknown> | null;
                  const to = step.to_stage as JobStage;
                  return (
                    <div key={step.id as string} className="relative">
                      <div className="absolute -left-6 top-1 w-3 h-3 rounded-full bg-purple-600 ring-4 ring-white" />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STAGE_COLORS[to] || "bg-gray-100"}`}>
                            {STAGE_LABELS[to] || (step.to_stage as string)}
                          </span>
                          {step.is_override ? (
                            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                              Override
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          By {(changedBy?.full_name as string) || "System"} ·{" "}
                          {formatDateTime(step.created_at as string)}
                        </p>
                        {step.reason ? (
                          <p className="text-xs text-gray-700 mt-1 bg-gray-50 p-2 rounded border border-gray-100">
                            {step.reason as string}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Comments Feed & Form */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm flex flex-col h-full">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Team Discussions & Notes</h2>

            <div className="flex-1 overflow-y-auto space-y-4 max-h-[420px] mb-4 pr-1 divide-y divide-gray-50">
              {comments.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  No comments yet. Start a discussion below!
                </div>
              ) : (
                comments.map((c) => {
                  const author = (c.author || null) as Record<string, unknown> | null;
                  return (
                    <div key={c.id as string} className="pt-3 first:pt-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-gray-900">
                            {(author?.full_name as string) || "Team Member"}
                          </span>
                          {author?.role ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                              {ROLE_LABELS[author.role as UserRole] || (author.role as string)}
                            </span>
                          ) : null}
                          {c.is_internal ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">
                              Internal
                            </span>
                          ) : null}
                        </div>
                        <span className="text-[11px] text-gray-400">
                          {formatDateTime(c.created_at as string)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{c.content as string}</p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Comment Form */}
            <form onSubmit={handleAddComment} className="border-t border-gray-100 pt-4 space-y-3">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write an internal note or team update..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isInternalComment}
                    onChange={(e) => setIsInternalComment(e.target.checked)}
                    className="rounded text-purple-600 focus:ring-purple-500"
                  />
                  <span>Mark as internal management note</span>
                </label>
                <button
                  type="submit"
                  disabled={submittingComment || !commentText.trim()}
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-300 text-white rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-1.5"
                >
                  {submittingComment ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Post Comment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. FINANCE TAB */}
      {activeTab === "finance" && (
        <div className="space-y-6">
          {/* Invoices List */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Invoices</h2>
                <p className="text-xs text-gray-500 mt-0.5">Billing documents generated for this job</p>
              </div>
              {profile.role === "FINANCE" && (
                <Link
                  href="/invoices"
                  className="text-xs text-purple-600 hover:text-purple-700 font-medium inline-flex items-center gap-1"
                >
                  View Invoices <ChevronRight size={14} />
                </Link>
              )}
            </div>

            {invoices.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">
                <FileText size={32} className="mx-auto mb-2 opacity-30" />
                No invoice issued for this job yet.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {invoices.map((inv) => (
                  <div key={inv.id as string} className="py-3.5 flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{inv.invoice_number as string}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Due: {formatDate(inv.due_date as string | null)} · Created:{" "}
                        {formatDate(inv.created_at as string)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(inv.total as number)}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                        {inv.status as string}
                      </span>
                      {inv.pdf_path ? (
                        <a
                          href={inv.pdf_path as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 text-gray-500 hover:text-purple-600"
                        >
                          <Download size={16} />
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Payments List */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Payment Records</h2>
            {payments.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">
                <CreditCard size={32} className="mx-auto mb-2 opacity-30" />
                No payments reported for this job yet.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {payments.map((p) => {
                  const reporter = (p.reported_by_profile || null) as Record<string, unknown> | null;
                  const isVerified = p.status === "VERIFIED";
                  return (
                    <div key={p.id as string} className="py-3.5 flex items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">
                            {formatCurrency(p.amount as number)}
                          </p>
                          <span
                            className={`text-xs px-2 py-0.5 rounded font-semibold ${
                              isVerified ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {p.status as string}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Method: {(p.payment_method as string) || "Bank Transfer"} · Ref:{" "}
                          {(p.reference_number as string) || "—"} · Reported by:{" "}
                          {(reporter?.full_name as string) || "Team"}
                        </p>
                      </div>
                      <span className="text-xs text-gray-400">
                        {formatDate(p.payment_date as string | null || p.reported_at as string)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Action Dialog Modal for Revision or Cancellation */}
      {dialogAction && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-gray-900">
                {dialogAction === "revision" ? "Request Work Revision" : "Cancel Job"}
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                {dialogAction === "revision"
                  ? "Describe what changes are needed before work can be approved."
                  : "Please provide a clear cancellation reason for the audit trail."}
              </p>
            </div>

            <textarea
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              rows={4}
              placeholder={
                dialogAction === "revision"
                  ? "Specify what adjustments the design/creative team should make..."
                  : "Reason for cancelling this job..."
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />

            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setDialogAction(null);
                  setActionNotes("");
                }}
                disabled={transitioning}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={transitioning || !actionNotes.trim()}
                onClick={() =>
                  handleTransition(
                    dialogAction === "revision" ? "REVISION_REQUESTED" : "CANCELLED",
                    actionNotes
                  )
                }
                className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors inline-flex items-center gap-1.5 ${
                  dialogAction === "revision"
                    ? "bg-amber-600 hover:bg-amber-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {transitioning ? <Loader2 size={16} className="animate-spin" /> : null}
                {dialogAction === "revision" ? "Submit Revision Request" : "Confirm Cancellation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
