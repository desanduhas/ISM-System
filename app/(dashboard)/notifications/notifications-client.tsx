"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCheck,
  Check,
  Briefcase,
  MessageSquare,
  Clock,
  Filter,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { formatDateTime, STAGE_LABELS, STAGE_COLORS } from "@/lib/utils";
import type { JobStage } from "@/lib/types";
import { toast } from "sonner";

interface NotificationItem {
  id: string;
  recipient_id: string;
  job_id: string | null;
  title: string;
  body: string;
  category: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  job?: {
    id: string;
    job_number: string;
    title: string;
    current_stage: JobStage;
  } | null;
}

interface NotificationsClientProps {
  initialNotifications: Array<Record<string, unknown>>;
}

export default function NotificationsClient({
  initialNotifications,
}: NotificationsClientProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    (initialNotifications as unknown as NotificationItem[]) || []
  );
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.is_read).length,
    [notifications]
  );

  const categories = useMemo(() => {
    const set = new Set<string>();
    notifications.forEach((n) => {
      if (n.category) set.add(n.category);
    });
    return Array.from(set);
  }, [notifications]);

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      const matchRead = filter === "all" || !n.is_read;
      const matchCat = categoryFilter === "ALL" || n.category === categoryFilter;
      return matchRead && matchCat;
    });
  }, [notifications, filter, categoryFilter]);

  async function markAllAsRead() {
    setLoadingAction("mark_all");
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mark_all: true }),
      });

      if (!res.ok) throw new Error("Failed to mark notifications as read");

      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          is_read: true,
          read_at: new Date().toISOString(),
        }))
      );
      toast.success("All notifications marked as read");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error updating notifications");
    } finally {
      setLoadingAction(null);
    }
  }

  async function markAsRead(id: string) {
    try {
      const res = await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error("Failed to mark notification as read");

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        )
      );
    } catch {
      toast.error("Failed to update notification");
    }
  }

  function getCategoryIcon(cat: string) {
    switch (cat) {
      case "JOB_COMMENT":
        return <MessageSquare size={16} className="text-blue-500" />;
      case "STAGE_CHANGE":
      case "STAGE_COMPLETED":
        return <Clock size={16} className="text-purple-500" />;
      default:
        return <Briefcase size={16} className="text-slate-500" />;
    }
  }

  return (
    <div className="operations-module module-notifications">
      {/* Header */}
      <div className="module-heading flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
            Notifications
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {unreadCount} unread of {notifications.length}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            disabled={loadingAction === "mark_all"}
            className="inline-flex items-center gap-2 px-3.5 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors shadow-sm self-start sm:self-auto"
          >
            {loadingAction === "mark_all" ? (
              <Loader2 size={16} className="animate-spin text-purple-600" />
            ) : (
              <CheckCheck size={16} className="text-purple-600" />
            )}
            Mark all as read
          </button>
        )}
      </div>

      {/* Filter Tabs & Dropdown */}
      <div className="module-toolbar flex items-center justify-between gap-3 flex-wrap border-b border-gray-200 pb-3">
        <div className="flex space-x-2">
          <button
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === "all"
                ? "bg-purple-100 text-purple-700 font-semibold"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            aria-pressed={filter === "unread"}
            onClick={() => setFilter("unread")}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === "unread"
                ? "bg-purple-100 text-purple-700 font-semibold"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Unread ({unreadCount})
          </button>
        </div>

        {categories.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Filter size={12} /> Category:
            </span>
            <select
              aria-label="Notification category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Notifications List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Bell size={36} className="mx-auto text-gray-300 mb-3" />
            <p className="text-gray-500 font-medium">No notifications</p>
            <p className="text-gray-400 text-sm mt-1">
              {filter === "unread"
                ? "You're all caught up with your notifications!"
                : "Activity updates and notifications will appear here."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((item) => (
              <div
                key={item.id}
                className={`p-4 sm:p-5 flex items-start gap-4 transition-colors ${
                  !item.is_read ? "bg-purple-50/40 hover:bg-purple-50/70" : "hover:bg-gray-50"
                }`}
              >
                {/* Category Icon */}
                <div className="p-2 rounded-xl bg-gray-50 border border-gray-100 shrink-0 mt-0.5">
                  {getCategoryIcon(item.category)}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className={`text-sm ${!item.is_read ? "font-semibold text-gray-900" : "font-medium text-gray-800"}`}>
                      {item.title}
                    </p>
                    <span className="text-xs text-gray-400 shrink-0">
                      {formatDateTime(item.created_at)}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600 mt-1 leading-relaxed">{item.body}</p>

                  {/* Attached Job Info */}
                  {item.job ? (
                    <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/jobs/${item.job.id}`}
                        className="inline-flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 font-medium bg-purple-50 px-2.5 py-1 rounded-md transition-colors"
                      >
                        <Briefcase size={12} />
                        <span>{item.job.job_number} — {item.job.title}</span>
                        <ChevronRight size={12} />
                      </Link>
                      {item.job.current_stage && (
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                            STAGE_COLORS[item.job.current_stage] || "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {STAGE_LABELS[item.job.current_stage] || item.job.current_stage}
                        </span>
                      )}
                    </div>
                  ) : null}
                </div>

                {/* Mark as read button */}
                {!item.is_read && (
                  <button
                    onClick={() => markAsRead(item.id)}
                    title="Mark as read"
                    className="p-1.5 rounded-lg text-gray-400 hover:text-purple-600 hover:bg-white transition-colors shrink-0"
                  >
                    <Check size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
