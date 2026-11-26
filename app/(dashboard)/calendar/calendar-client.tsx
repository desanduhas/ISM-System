"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Clock,
  MapPin,
  RotateCcw,
} from "lucide-react";
import CreateJobDialog from "@/components/jobs/create-job-dialog";
import {
  STAGE_LABELS,
  STAGE_COLORS,
  JOB_TYPES,
  formatCurrency,
  isOverdue,
} from "@/lib/utils";
import type {
  Job,
  Profile,
  Department,
  Client,
} from "@/lib/types";

export interface CalendarJob extends Omit<Job, "assigned_profile" | "department"> {
  client?: Client;
  assigned_profile?: {
    id: string;
    full_name: string;
    role: string;
  } | null;
  department?: Department | null;
}

interface CalendarClientProps {
  initialJobs: CalendarJob[];
  clients: Array<{ id: string; company_name: string }>;
  employees: Array<{ id: string; full_name: string; role: string; department_id?: string | null }>;
  departments: Department[];
  currentUser: Profile;
}

type ViewMode = "month" | "week" | "day";

interface CalendarEventItem {
  id: string;
  jobId: string;
  job: CalendarJob;
  date: Date;
  eventType: "VISIT" | "DEADLINE";
  title: string;
  isOverdue: boolean;
}

// Sri Lankan business hours range for Day Agenda: 8:00 AM to 7:00 PM (UTC+5:30)
const BUSINESS_HOURS = [
  8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
];

function formatHour(hour: number): string {
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:00 ${period}`;
}

export default function CalendarClient({
  initialJobs,
  clients,
  employees,
  departments,
  currentUser,
}: CalendarClientProps) {
  const router = useRouter();

  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Filters state
  const [filterEmployee, setFilterEmployee] = useState<string>("ALL");
  const [filterDepartment, setFilterDepartment] = useState<string>("ALL");
  const [filterJobType, setFilterJobType] = useState<string>("ALL");
  const [filterStage, setFilterStage] = useState<string>("ALL");
  const [filterClient, setFilterClient] = useState<string>("ALL");
  const [filterEventType, setFilterEventType] = useState<"ALL" | "VISIT" | "DEADLINE">("ALL");

  const canCreateJob = currentUser.role === "MANAGEMENT";

  // Reset filters
  function resetFilters() {
    setFilterEmployee("ALL");
    setFilterDepartment("ALL");
    setFilterJobType("ALL");
    setFilterStage("ALL");
    setFilterClient("ALL");
    setFilterEventType("ALL");
  }

  const hasActiveFilters =
    filterEmployee !== "ALL" ||
    filterDepartment !== "ALL" ||
    filterJobType !== "ALL" ||
    filterStage !== "ALL" ||
    filterClient !== "ALL" ||
    filterEventType !== "ALL";

  // Filter jobs
  const filteredJobs = useMemo(() => {
    return initialJobs.filter((job) => {
      if (filterEmployee !== "ALL" && job.assigned_to !== filterEmployee) return false;
      if (filterDepartment !== "ALL" && job.department_id !== filterDepartment) return false;
      if (filterJobType !== "ALL" && job.job_type !== filterJobType) return false;
      if (filterStage !== "ALL" && job.current_stage !== filterStage) return false;
      if (filterClient !== "ALL" && job.client_id !== filterClient) return false;
      return true;
    });
  }, [
    initialJobs,
    filterEmployee,
    filterDepartment,
    filterJobType,
    filterStage,
    filterClient,
  ]);

  // Generate calendar events from filtered jobs
  const allEvents = useMemo(() => {
    const list: CalendarEventItem[] = [];

    filteredJobs.forEach((job) => {
      const overdue =
        isOverdue(job.deadline) &&
        !["COMPLETED", "CANCELLED"].includes(job.current_stage);

      if (job.visit_date && (filterEventType === "ALL" || filterEventType === "VISIT")) {
        list.push({
          id: `${job.id}-visit`,
          jobId: job.id,
          job,
          date: new Date(job.visit_date),
          eventType: "VISIT",
          title: `Visit: ${job.client?.company_name || job.title}`,
          isOverdue: false,
        });
      }

      if (job.deadline && (filterEventType === "ALL" || filterEventType === "DEADLINE")) {
        list.push({
          id: `${job.id}-deadline`,
          jobId: job.id,
          job,
          date: new Date(job.deadline),
          eventType: "DEADLINE",
          title: `Due: ${job.title}`,
          isOverdue: overdue,
        });
      }
    });

    return list;
  }, [filteredJobs, filterEventType]);

  // Date Navigation
  function handlePrev() {
    const d = new Date(currentDate);
    if (viewMode === "month") {
      d.setMonth(d.getMonth() - 1);
    } else if (viewMode === "week") {
      d.setDate(d.getDate() - 7);
    } else {
      d.setDate(d.getDate() - 1);
    }
    setCurrentDate(d);
  }

  function handleNext() {
    const d = new Date(currentDate);
    if (viewMode === "month") {
      d.setMonth(d.getMonth() + 1);
    } else if (viewMode === "week") {
      d.setDate(d.getDate() + 7);
    } else {
      d.setDate(d.getDate() + 1);
    }
    setCurrentDate(d);
  }

  function handleToday() {
    setCurrentDate(new Date());
  }

  // Heading formatted string
  const currentHeading = useMemo(() => {
    if (viewMode === "month") {
      return currentDate.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });
    }
    if (viewMode === "week") {
      const start = getWeekStart(currentDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })} – ${end.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`;
    }
    return currentDate.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }, [currentDate, viewMode]);

  // Week helpers
  function getWeekStart(d: Date): Date {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    const monday = new Date(date.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  }

  const weekDays = useMemo(() => {
    const start = getWeekStart(currentDate);
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start);
      day.setDate(day.getDate() + i);
      return day;
    });
  }, [currentDate]);

  // Month grid helpers
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startDayIndex = (firstDayOfMonth.getDay() + 6) % 7; // Monday = 0
    const totalDays = lastDayOfMonth.getDate();

    const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];

    // Prev month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayIndex - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Next month padding to fill complete weeks (35 or 42 cells)
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        days.push({
          date: new Date(year, month + 1, i),
          isCurrentMonth: false,
        });
      }
    }

    return days;
  }, [currentDate]);

  function isSameDay(d1: Date, d2: Date): boolean {
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  }

  const today = new Date();

  return (
    <div className="operations-module module-calendar">
      {/* Top Header */}
      <div className="module-heading flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Operations calendar
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Client visits, shoots and production deadlines.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {canCreateJob && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium shadow-sm transition-colors"
            >
              <Plus size={16} />
              New Job
            </button>
          )}
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="module-toolbar bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
            <Filter size={14} className="text-purple-600" />
            Filters & Views
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 hover:underline font-medium"
            >
              <RotateCcw size={12} />
              Reset filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Employee filter */}
          <div>
            <label htmlFor="calendar-employee-1" className="block text-[11px] font-medium text-slate-500 mb-1">
              Employee
            </label>
            <select
              id="calendar-employee-1"
              value={filterEmployee}
              onChange={(e) => setFilterEmployee(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="ALL">All Staff</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.full_name}
                </option>
              ))}
            </select>
          </div>

          {/* Department filter */}
          <div>
            <label htmlFor="calendar-department-2" className="block text-[11px] font-medium text-slate-500 mb-1">
              Department
            </label>
            <select
              id="calendar-department-2"
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="ALL">All Depts</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Job Type filter */}
          <div>
            <label htmlFor="calendar-job-type-3" className="block text-[11px] font-medium text-slate-500 mb-1">
              Job Type
            </label>
            <select
              id="calendar-job-type-3"
              value={filterJobType}
              onChange={(e) => setFilterJobType(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="ALL">All Types</option>
              {JOB_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Stage filter */}
          <div>
            <label htmlFor="calendar-stage-4" className="block text-[11px] font-medium text-slate-500 mb-1">
              Stage
            </label>
            <select
              id="calendar-stage-4"
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="ALL">All Stages</option>
              {Object.entries(STAGE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          {/* Client filter */}
          <div>
            <label htmlFor="calendar-client-5" className="block text-[11px] font-medium text-slate-500 mb-1">
              Client
            </label>
            <select
              id="calendar-client-5"
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="ALL">All Clients</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company_name}
                </option>
              ))}
            </select>
          </div>

          {/* Event Type filter */}
          <div>
            <label htmlFor="calendar-event-category-6" className="block text-[11px] font-medium text-slate-500 mb-1">
              Event Category
            </label>
            <select
              id="calendar-event-category-6"
              value={filterEventType}
              onChange={(e) =>
                setFilterEventType(e.target.value as "ALL" | "VISIT" | "DEADLINE")
              }
              className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              <option value="ALL">Visits & Deadlines</option>
              <option value="VISIT">Visits Only</option>
              <option value="DEADLINE">Deadlines Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Calendar Controls & Navigation Bar */}
      <div className="calendar-navigation bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Navigation buttons */}
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden">
            <button
              onClick={handlePrev}
              className="p-2 hover:bg-slate-50 text-slate-600 transition-colors"
              title="Previous"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-xs font-semibold hover:bg-slate-50 text-slate-700 border-x border-slate-200 transition-colors"
            >
              Today
            </button>
            <button
              onClick={handleNext}
              className="p-2 hover:bg-slate-50 text-slate-600 transition-colors"
              title="Next"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            {currentHeading}
          </h2>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-2">
          {/* Legend */}
          <div className="hidden lg:flex items-center gap-3 mr-4 text-xs">
            <span className="flex items-center gap-1.5 text-blue-700">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              Visit
            </span>
            <span className="flex items-center gap-1.5 text-purple-700">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
              Deadline
            </span>
            <span className="flex items-center gap-1.5 text-rose-700">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
              Overdue
            </span>
          </div>

          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              aria-pressed={viewMode === "month"}
              onClick={() => setViewMode("month")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === "month"
                  ? "bg-white text-purple-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Month
            </button>
            <button
              aria-pressed={viewMode === "week"}
              onClick={() => setViewMode("week")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === "week"
                  ? "bg-white text-purple-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Week
            </button>
            <button
              aria-pressed={viewMode === "day"}
              onClick={() => setViewMode("day")}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === "day"
                  ? "bg-white text-purple-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Day
            </button>
          </div>
        </div>
      </div>

      {/* VIEW 1: MONTH GRID */}
      {viewMode === "month" && (
        <div className="calendar-month bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Day of Week Header */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider py-2.5">
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
            <div>Sun</div>
          </div>

          {/* Month Calendar Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 min-h-[600px]">
            {monthDays.map((cell, idx) => {
              const isToday = isSameDay(cell.date, today);
              const dayEvents = allEvents.filter((ev) => isSameDay(ev.date, cell.date));

              return (
                <div
                  key={idx}
                  className={`p-2 min-h-[110px] flex flex-col justify-between transition-colors ${
                    !cell.isCurrentMonth
                      ? "bg-slate-50/60 text-slate-400"
                      : "bg-white text-slate-800"
                  } ${isToday ? "bg-purple-50/30" : ""}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <button
                      type="button"
                      aria-label={`Open agenda for ${cell.date.toLocaleDateString("en-GB", { dateStyle: "full" })}`}
                      onClick={() => {
                        setCurrentDate(cell.date);
                        setViewMode("day");
                      }}
                      className={`calendar-date text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday
                          ? "bg-purple-600 text-white shadow-sm"
                          : cell.isCurrentMonth
                          ? "text-slate-700"
                          : "text-slate-400"
                      }`}
                    >
                      {cell.date.getDate()}
                    </button>
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] text-slate-400 font-medium">
                        {dayEvents.length} {dayEvents.length === 1 ? "task" : "tasks"}
                      </span>
                    )}
                  </div>

                  {/* Day Events Stack */}
                  <div className="space-y-1 overflow-y-auto max-h-[85px] pr-0.5">
                    {dayEvents.map((ev) => {
                      const isVisit = ev.eventType === "VISIT";
                      const isOver = ev.isOverdue;

                      let badgeStyle = isVisit
                        ? "bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100"
                        : "bg-purple-50 text-purple-800 border-purple-200 hover:bg-purple-100";

                      if (isOver) {
                        badgeStyle =
                          "bg-rose-50 text-rose-800 border-rose-300 font-semibold hover:bg-rose-100";
                      }

                      return (
                        <Link
                          key={ev.id}
                          href={`/jobs/${ev.jobId}`}
                          className={`block p-1.5 rounded-lg border text-[11px] leading-tight transition-all shadow-xs ${badgeStyle}`}
                          title={`${ev.title} (${STAGE_LABELS[ev.job.current_stage]})`}
                        >
                          <div className="flex items-center gap-1 font-medium truncate">
                            {isVisit ? (
                              <MapPin size={11} className="shrink-0 text-blue-600" />
                            ) : (
                              <Clock
                                size={11}
                                className={`shrink-0 ${
                                  isOver ? "text-rose-600" : "text-purple-600"
                                }`}
                              />
                            )}
                            <span className="truncate">{ev.job.job_number}</span>
                          </div>
                          <p className="truncate text-[10px] text-slate-600 font-normal mt-0.5">
                            {ev.job.title}
                          </p>
                          <div className="flex items-center justify-between gap-1 mt-1 text-[9px]">
                            <span
                              className={`px-1 rounded ${
                                STAGE_COLORS[ev.job.current_stage] || "bg-slate-200"
                              }`}
                            >
                              {STAGE_LABELS[ev.job.current_stage]}
                            </span>
                            {isOver && (
                              <span className="text-rose-600 font-bold">OVERDUE</span>
                            )}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 2: WEEK GRID */}
      {viewMode === "week" && (
        <div className="calendar-week bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="grid grid-cols-7 divide-x divide-slate-200 border-b border-slate-200 bg-slate-50 text-center py-3">
            {weekDays.map((d, idx) => {
              const isToday = isSameDay(d, today);
              return (
                <div key={idx} className="space-y-1">
                  <p className="text-xs uppercase text-slate-500 font-semibold tracking-wider">
                    {d.toLocaleDateString("en-US", { weekday: "short" })}
                  </p>
                  <p
                    className={`inline-flex items-center justify-center w-7 h-7 text-sm font-bold rounded-full ${
                      isToday
                        ? "bg-purple-600 text-white shadow-sm"
                        : "text-slate-900"
                    }`}
                  >
                    {d.getDate()}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-7 divide-x divide-slate-100 min-h-[500px] p-2 bg-slate-50/30">
            {weekDays.map((d, idx) => {
              const dayEvents = allEvents.filter((ev) => isSameDay(ev.date, d));

              return (
                <div key={idx} className="space-y-2 p-1.5">
                  <p className="calendar-week-day">{d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" })}</p>
                  {dayEvents.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-[11px] text-slate-300 py-10">
                      No events
                    </div>
                  ) : (
                    dayEvents.map((ev) => {
                      const isVisit = ev.eventType === "VISIT";
                      const isOver = ev.isOverdue;

                      return (
                        <Link
                          key={ev.id}
                          href={`/jobs/${ev.jobId}`}
                          className={`block p-2.5 rounded-xl border text-xs transition-all shadow-xs ${
                            isOver
                              ? "bg-rose-50 border-rose-300 hover:border-rose-400"
                              : isVisit
                              ? "bg-blue-50/70 border-blue-200 hover:border-blue-300"
                              : "bg-white border-slate-200 hover:border-purple-300"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-mono text-[10px] font-bold text-slate-500">
                              {ev.job.job_number}
                            </span>
                            <span
                              className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                                STAGE_COLORS[ev.job.current_stage]
                              }`}
                            >
                              {STAGE_LABELS[ev.job.current_stage]}
                            </span>
                          </div>

                          <p className="font-semibold text-slate-900 line-clamp-2">
                            {ev.job.title}
                          </p>

                          <div className="mt-2 space-y-1 text-[11px] text-slate-500 pt-2 border-t border-slate-200/60">
                            <div className="flex items-center gap-1.5">
                              {isVisit ? (
                                <MapPin size={12} className="text-blue-600" />
                              ) : (
                                <Clock size={12} className="text-purple-600" />
                              )}
                              <span>
                                {ev.date.toLocaleTimeString("en-US", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>

                            {ev.job.client?.company_name && (
                              <p className="truncate text-slate-700 font-medium">
                                {ev.job.client.company_name}
                              </p>
                            )}

                            {ev.job.assigned_profile && (
                              <p className="text-slate-500 truncate">
                                👤 {ev.job.assigned_profile.full_name}
                              </p>
                            )}
                          </div>

                          {isOver && (
                            <div className="mt-2 text-[10px] text-rose-700 font-bold bg-rose-100 px-1.5 py-0.5 rounded text-center">
                              OVERDUE DEADLINE
                            </div>
                          )}
                        </Link>
                      );
                    })
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW 3: DAY AGENDA SCHEDULE (Sri Lankan Business Hours: 08:00 - 19:00) */}
      {viewMode === "day" && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Daily schedule
              </p>
              <p className="text-xs text-slate-500">
                Visit times and deadlines
              </p>
            </div>
            <div className="text-xs font-medium text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
              {allEvents.filter((e) => isSameDay(e.date, currentDate)).length} events scheduled
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {BUSINESS_HOURS.map((hour) => {
              const hourEvents = allEvents.filter(
                (ev) =>
                  isSameDay(ev.date, currentDate) && ev.date.getHours() === hour
              );

              return (
                <div
                  key={hour}
                  className="flex flex-col sm:flex-row sm:items-start p-4 hover:bg-slate-50/50 transition-colors gap-4"
                >
                  {/* Hour label */}
                  <div className="w-24 shrink-0 text-xs font-semibold text-slate-500 pt-1">
                    {formatHour(hour)}
                  </div>

                  {/* Hourly Events Slot */}
                  <div className="flex-1 space-y-3">
                    {hourEvents.length === 0 ? (
                      <p className="text-xs text-slate-300 italic pt-1">No scheduled jobs</p>
                    ) : (
                      hourEvents.map((ev) => {
                        const isVisit = ev.eventType === "VISIT";
                        const isOver = ev.isOverdue;

                        return (
                          <div
                            key={ev.id}
                            className={`p-4 rounded-xl border transition-all ${
                              isOver
                                ? "border-rose-300 bg-rose-50/40"
                                : isVisit
                                ? "border-blue-200 bg-blue-50/30"
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`text-xs px-2 py-0.5 rounded font-mono font-bold ${
                                    isVisit
                                      ? "bg-blue-100 text-blue-800"
                                      : "bg-purple-100 text-purple-800"
                                  }`}
                                >
                                  {ev.eventType}
                                </span>
                                <span className="text-xs font-mono text-slate-500 font-semibold">
                                  {ev.job.job_number}
                                </span>
                                <Link
                                  href={`/jobs/${ev.jobId}`}
                                  className="text-sm font-bold text-slate-900 hover:text-purple-600 transition-colors"
                                >
                                  {ev.job.title}
                                </Link>
                              </div>

                              <div className="flex items-center gap-2">
                                {isOver && (
                                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                                    Overdue
                                  </span>
                                )}
                                <span
                                  className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                                    STAGE_COLORS[ev.job.current_stage]
                                  }`}
                                >
                                  {STAGE_LABELS[ev.job.current_stage]}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-600 pt-2 border-t border-slate-100">
                              <div>
                                <span className="block text-slate-400">Client</span>
                                <span className="font-semibold text-slate-800">
                                  {ev.job.client?.company_name || "—"}
                                </span>
                              </div>

                              <div>
                                <span className="block text-slate-400">Time</span>
                                <span className="font-semibold text-slate-800">
                                  {ev.date.toLocaleTimeString("en-US", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>

                              <div>
                                <span className="block text-slate-400">Assigned To</span>
                                <span className="font-semibold text-slate-800">
                                  {ev.job.assigned_profile?.full_name || "Unassigned"}
                                </span>
                              </div>

                              <div>
                                <span className="block text-slate-400">Agreed Price</span>
                                <span className="font-semibold text-slate-800">
                                  {ev.job.agreed_price
                                    ? formatCurrency(ev.job.agreed_price)
                                    : "—"}
                                </span>
                              </div>
                            </div>

                            {isVisit && ev.job.visit_location && (
                              <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5 bg-white/70 p-2 rounded-lg border border-slate-100">
                                <MapPin size={13} className="text-blue-500 shrink-0" />
                                <span>{ev.job.visit_location}</span>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* New Job Modal (Management only) */}
      {isCreateOpen && (
        <CreateJobDialog
          clients={clients}
          profiles={employees}
          onClose={() => setIsCreateOpen(false)}
          onCreated={() => {
            setIsCreateOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
