import type { UserRole, JobStage } from "@/lib/types";

export const ROLE_LABELS: Record<UserRole, string> = {
  MANAGEMENT: "Management",
  MARKETING_CUSTOMER_CARE: "Marketing & Customer Care",
  GRAPHIC_DESIGNER: "Graphic Designer",
  CAPTURING: "Capturing",
  FINANCE: "Finance",
};

export const ROLE_PERMISSIONS = {
  MANAGEMENT: {
    canCreateJob: true,
    canCancelJob: true,
    canOverrideStage: true,
    canApproveWork: true,
    canManageEmployees: true,
    canViewFinance: true,
    canCreateInvoice: false,
    canVerifyPayment: false,
    canSendToClient: true,
    canReportPayment: false,
    canViewAllJobs: true,
    canAssignJobs: true,
    canViewCalendarAll: true,
    canViewAuditLogs: true,
    canViewWhatsAppLogs: true,
  },
  MARKETING_CUSTOMER_CARE: {
    canCreateJob: false,
    canCancelJob: false,
    canOverrideStage: false,
    canApproveWork: false,
    canManageEmployees: false,
    canViewFinance: false,
    canCreateInvoice: false,
    canVerifyPayment: false,
    canSendToClient: true,
    canReportPayment: true,
    canViewAllJobs: false,
    canAssignJobs: false,
    canViewCalendarAll: false,
    canViewAuditLogs: false,
    canViewWhatsAppLogs: false,
  },
  GRAPHIC_DESIGNER: {
    canCreateJob: false,
    canCancelJob: false,
    canOverrideStage: false,
    canApproveWork: false,
    canManageEmployees: false,
    canViewFinance: false,
    canCreateInvoice: false,
    canVerifyPayment: false,
    canSendToClient: false,
    canReportPayment: false,
    canViewAllJobs: false,
    canAssignJobs: false,
    canViewCalendarAll: false,
    canViewAuditLogs: false,
    canViewWhatsAppLogs: false,
  },
  CAPTURING: {
    canCreateJob: false,
    canCancelJob: false,
    canOverrideStage: false,
    canApproveWork: false,
    canManageEmployees: false,
    canViewFinance: false,
    canCreateInvoice: false,
    canVerifyPayment: false,
    canSendToClient: false,
    canReportPayment: false,
    canViewAllJobs: false,
    canAssignJobs: false,
    canViewCalendarAll: false,
    canViewAuditLogs: false,
    canViewWhatsAppLogs: false,
  },
  FINANCE: {
    canCreateJob: false,
    canCancelJob: false,
    canOverrideStage: false,
    canApproveWork: false,
    canManageEmployees: false,
    canViewFinance: true,
    canCreateInvoice: true,
    canVerifyPayment: true,
    canSendToClient: false,
    canReportPayment: false,
    canViewAllJobs: false,
    canAssignJobs: false,
    canViewCalendarAll: false,
    canViewAuditLogs: false,
    canViewWhatsAppLogs: false,
  },
} as const;

export type Permission = keyof typeof ROLE_PERMISSIONS.MANAGEMENT;

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.[permission] ?? false;
}

export const STAGE_TRANSITIONS: Partial<Record<JobStage, { allowedRoles: UserRole[]; nextStage: JobStage }[]>> = {
  VISIT_SCHEDULED: [
    { allowedRoles: ["MARKETING_CUSTOMER_CARE", "MANAGEMENT"], nextStage: "VISIT_COMPLETED" },
    { allowedRoles: ["MANAGEMENT"], nextStage: "CANCELLED" },
  ],
  VISIT_COMPLETED: [
    { allowedRoles: ["MARKETING_CUSTOMER_CARE", "MANAGEMENT"], nextStage: "BRIEF_CONFIRMED" },
    { allowedRoles: ["MANAGEMENT"], nextStage: "CANCELLED" },
  ],
  BRIEF_CONFIRMED: [
    { allowedRoles: ["MANAGEMENT", "MARKETING_CUSTOMER_CARE"], nextStage: "IN_PRODUCTION" },
    { allowedRoles: ["MANAGEMENT"], nextStage: "CANCELLED" },
  ],
  IN_PRODUCTION: [
    {
      allowedRoles: ["GRAPHIC_DESIGNER", "CAPTURING", "MARKETING_CUSTOMER_CARE", "MANAGEMENT"],
      nextStage: "READY_FOR_REVIEW",
    },
    { allowedRoles: ["MANAGEMENT"], nextStage: "CANCELLED" },
  ],
  READY_FOR_REVIEW: [
    { allowedRoles: ["MANAGEMENT"], nextStage: "APPROVED" },
    { allowedRoles: ["MANAGEMENT"], nextStage: "REVISION_REQUESTED" },
  ],
  REVISION_REQUESTED: [
    {
      allowedRoles: ["GRAPHIC_DESIGNER", "CAPTURING", "MARKETING_CUSTOMER_CARE", "MANAGEMENT"],
      nextStage: "IN_PRODUCTION",
    },
  ],
  APPROVED: [
    { allowedRoles: ["FINANCE", "MANAGEMENT"], nextStage: "INVOICE_READY" },
  ],
  INVOICE_READY: [
    { allowedRoles: ["MARKETING_CUSTOMER_CARE", "MANAGEMENT"], nextStage: "SENT_TO_CLIENT" },
  ],
  SENT_TO_CLIENT: [
    { allowedRoles: ["MARKETING_CUSTOMER_CARE", "MANAGEMENT"], nextStage: "PAYMENT_REPORTED" },
  ],
  PAYMENT_REPORTED: [
    { allowedRoles: ["FINANCE", "MANAGEMENT"], nextStage: "PAYMENT_VERIFIED" },
  ],
  PAYMENT_VERIFIED: [
    { allowedRoles: ["FINANCE", "MANAGEMENT"], nextStage: "COMPLETED" },
  ],
  COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(role: UserRole, fromStage: JobStage, toStage: JobStage): boolean {
  const transitions = STAGE_TRANSITIONS[fromStage] || [];
  return transitions.some((t) => t.nextStage === toStage && t.allowedRoles.includes(role));
}

export function getAvailableTransitions(role: UserRole, fromStage: JobStage): JobStage[] {
  const transitions = STAGE_TRANSITIONS[fromStage] || [];
  return transitions.filter((t) => t.allowedRoles.includes(role)).map((t) => t.nextStage);
}
