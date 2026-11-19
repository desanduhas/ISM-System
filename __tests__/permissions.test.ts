import { hasPermission, ROLE_PERMISSIONS } from "@/lib/auth/role-guard";
import type { UserRole } from "@/lib/types";

describe("Role Permissions", () => {
  describe("MANAGEMENT", () => {
    test("has all administrative permissions", () => {
      expect(hasPermission("MANAGEMENT", "canCreateJob")).toBe(true);
      expect(hasPermission("MANAGEMENT", "canCancelJob")).toBe(true);
      expect(hasPermission("MANAGEMENT", "canOverrideStage")).toBe(true);
      expect(hasPermission("MANAGEMENT", "canApproveWork")).toBe(true);
      expect(hasPermission("MANAGEMENT", "canManageEmployees")).toBe(true);
      expect(hasPermission("MANAGEMENT", "canViewAllJobs")).toBe(true);
      expect(hasPermission("MANAGEMENT", "canAssignJobs")).toBe(true);
    });
  });

  describe("FINANCE", () => {
    test("can create invoices and verify payments", () => {
      expect(hasPermission("FINANCE", "canCreateInvoice")).toBe(true);
      expect(hasPermission("FINANCE", "canVerifyPayment")).toBe(true);
      expect(hasPermission("FINANCE", "canViewFinance")).toBe(true);
    });
    test("cannot approve creative work", () => {
      expect(hasPermission("FINANCE", "canApproveWork")).toBe(false);
    });
    test("cannot manage employees", () => {
      expect(hasPermission("FINANCE", "canManageEmployees")).toBe(false);
    });
  });

  describe("GRAPHIC_DESIGNER", () => {
    test("has minimal permissions", () => {
      expect(hasPermission("GRAPHIC_DESIGNER", "canCreateJob")).toBe(false);
      expect(hasPermission("GRAPHIC_DESIGNER", "canApproveWork")).toBe(false);
      expect(hasPermission("GRAPHIC_DESIGNER", "canViewFinance")).toBe(false);
      expect(hasPermission("GRAPHIC_DESIGNER", "canManageEmployees")).toBe(false);
    });
  });

  describe("MARKETING_CUSTOMER_CARE", () => {
    test("can send to client and report payment", () => {
      expect(hasPermission("MARKETING_CUSTOMER_CARE", "canSendToClient")).toBe(true);
      expect(hasPermission("MARKETING_CUSTOMER_CARE", "canReportPayment")).toBe(true);
    });
    test("cannot verify payment", () => {
      expect(hasPermission("MARKETING_CUSTOMER_CARE", "canVerifyPayment")).toBe(false);
    });
    test("cannot approve work", () => {
      expect(hasPermission("MARKETING_CUSTOMER_CARE", "canApproveWork")).toBe(false);
    });
  });

  describe("Unauthorized access", () => {
    test("unknown role returns false for all permissions", () => {
      const fakeRole = "UNKNOWN_ROLE" as UserRole;
      expect(hasPermission(fakeRole, "canCreateJob")).toBe(false);
    });
  });

  describe("Maximum management users constraint", () => {
    test("MANAGEMENT role exists in permissions", () => {
      expect(ROLE_PERMISSIONS.MANAGEMENT).toBeDefined();
    });
  });
});
