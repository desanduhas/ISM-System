import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { JobStage, UserRole } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return `LKR ${new Intl.NumberFormat("en-LK").format(amount)}`;
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatSriLankanPhone(phone: string): string {
  // Convert to E.164 format for Sri Lanka (+94)
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("94")) return `+${digits}`;
  if (digits.startsWith("0")) return `+94${digits.slice(1)}`;
  if (digits.length === 9) return `+94${digits}`;
  return `+${digits}`;
}

export const STAGE_LABELS: Record<JobStage, string> = {
  VISIT_SCHEDULED: "Visit Scheduled",
  VISIT_COMPLETED: "Visit Completed",
  BRIEF_CONFIRMED: "Brief Confirmed",
  IN_PRODUCTION: "In Production",
  READY_FOR_REVIEW: "Ready for Review",
  REVISION_REQUESTED: "Revision Requested",
  APPROVED: "Approved",
  INVOICE_READY: "Invoice Ready",
  SENT_TO_CLIENT: "Sent to Client",
  PAYMENT_REPORTED: "Payment Reported",
  PAYMENT_VERIFIED: "Payment Verified",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const STAGE_COLORS: Record<JobStage, string> = {
  VISIT_SCHEDULED: "bg-blue-100 text-blue-800",
  VISIT_COMPLETED: "bg-indigo-100 text-indigo-800",
  BRIEF_CONFIRMED: "bg-violet-100 text-violet-800",
  IN_PRODUCTION: "bg-amber-100 text-amber-800",
  READY_FOR_REVIEW: "bg-orange-100 text-orange-800",
  REVISION_REQUESTED: "bg-red-100 text-red-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  INVOICE_READY: "bg-cyan-100 text-cyan-800",
  SENT_TO_CLIENT: "bg-teal-100 text-teal-800",
  PAYMENT_REPORTED: "bg-pink-100 text-pink-800",
  PAYMENT_VERIFIED: "bg-green-100 text-green-800",
  COMPLETED: "bg-slate-100 text-slate-800",
  CANCELLED: "bg-gray-100 text-gray-500",
};

export const ROLE_LABELS: Record<UserRole, string> = {
  MANAGEMENT: "Management",
  MARKETING_CUSTOMER_CARE: "Marketing & Customer Care",
  GRAPHIC_DESIGNER: "Graphic Designer",
  CAPTURING: "Capturing",
  FINANCE: "Finance",
};

export const JOB_TYPES = [
  "Graphic Design",
  "Photography",
  "Videography",
  "Capturing",
  "Digital Marketing",
  "Social Media Management",
  "Content Creation",
  "Customer Care",
  "Other",
] as const;

export function isOverdue(deadline: string | null): boolean {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

export function generateIdempotencyKey(prefix: string, ...parts: string[]): string {
  return `${prefix}:${parts.join(":")}`;
}
