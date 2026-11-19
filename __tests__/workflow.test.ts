import { canTransition, getAvailableTransitions } from "@/lib/auth/role-guard";
import type { UserRole, JobStage } from "@/lib/types";

describe("Job Workflow State Machine", () => {
  describe("MANAGEMENT role transitions", () => {
    test("can approve work from READY_FOR_REVIEW", () => {
      expect(canTransition("MANAGEMENT", "READY_FOR_REVIEW", "APPROVED")).toBe(true);
    });
    test("can request revision from READY_FOR_REVIEW", () => {
      expect(canTransition("MANAGEMENT", "READY_FOR_REVIEW", "REVISION_REQUESTED")).toBe(true);
    });
    test("can cancel any active job", () => {
      const stages: JobStage[] = ["VISIT_SCHEDULED", "VISIT_COMPLETED", "BRIEF_CONFIRMED", "IN_PRODUCTION"];
      stages.forEach(stage => {
        expect(canTransition("MANAGEMENT", stage, "CANCELLED")).toBe(true);
      });
    });
    test("cannot skip from VISIT_SCHEDULED to IN_PRODUCTION without override", () => {
      expect(canTransition("MANAGEMENT", "VISIT_SCHEDULED", "IN_PRODUCTION")).toBe(false);
    });
  });

  describe("GRAPHIC_DESIGNER role transitions", () => {
    test("can submit work from IN_PRODUCTION to READY_FOR_REVIEW", () => {
      expect(canTransition("GRAPHIC_DESIGNER", "IN_PRODUCTION", "READY_FOR_REVIEW")).toBe(true);
    });
    test("cannot approve their own work", () => {
      expect(canTransition("GRAPHIC_DESIGNER", "READY_FOR_REVIEW", "APPROVED")).toBe(false);
    });
    test("cannot cancel a job", () => {
      expect(canTransition("GRAPHIC_DESIGNER", "IN_PRODUCTION", "CANCELLED")).toBe(false);
    });
    test("cannot create invoice", () => {
      expect(canTransition("GRAPHIC_DESIGNER", "APPROVED", "INVOICE_READY")).toBe(false);
    });
  });

  describe("FINANCE role transitions", () => {
    test("can create invoice (APPROVED → INVOICE_READY)", () => {
      expect(canTransition("FINANCE", "APPROVED", "INVOICE_READY")).toBe(true);
    });
    test("can verify payment (PAYMENT_REPORTED → PAYMENT_VERIFIED)", () => {
      expect(canTransition("FINANCE", "PAYMENT_REPORTED", "PAYMENT_VERIFIED")).toBe(true);
    });
    test("cannot approve creative work", () => {
      expect(canTransition("FINANCE", "READY_FOR_REVIEW", "APPROVED")).toBe(false);
    });
    test("cannot cancel a job", () => {
      expect(canTransition("FINANCE", "IN_PRODUCTION", "CANCELLED")).toBe(false);
    });
  });

  describe("MARKETING_CUSTOMER_CARE role transitions", () => {
    test("can mark visit completed", () => {
      expect(canTransition("MARKETING_CUSTOMER_CARE", "VISIT_SCHEDULED", "VISIT_COMPLETED")).toBe(true);
    });
    test("can send to client", () => {
      expect(canTransition("MARKETING_CUSTOMER_CARE", "INVOICE_READY", "SENT_TO_CLIENT")).toBe(true);
    });
    test("can report payment", () => {
      expect(canTransition("MARKETING_CUSTOMER_CARE", "SENT_TO_CLIENT", "PAYMENT_REPORTED")).toBe(true);
    });
    test("cannot verify payment", () => {
      expect(canTransition("MARKETING_CUSTOMER_CARE", "PAYMENT_REPORTED", "PAYMENT_VERIFIED")).toBe(false);
    });
    test("cannot approve work", () => {
      expect(canTransition("MARKETING_CUSTOMER_CARE", "READY_FOR_REVIEW", "APPROVED")).toBe(false);
    });
  });

  describe("CAPTURING role transitions", () => {
    test("can submit work from IN_PRODUCTION", () => {
      expect(canTransition("CAPTURING", "IN_PRODUCTION", "READY_FOR_REVIEW")).toBe(true);
    });
    test("cannot approve their own work", () => {
      expect(canTransition("CAPTURING", "READY_FOR_REVIEW", "APPROVED")).toBe(false);
    });
  });

  describe("Completed and Cancelled stages", () => {
    test("no transitions from COMPLETED", () => {
      const transitions = getAvailableTransitions("MANAGEMENT", "COMPLETED");
      expect(transitions).toHaveLength(0);
    });
    test("no transitions from CANCELLED", () => {
      const transitions = getAvailableTransitions("MANAGEMENT", "CANCELLED");
      expect(transitions).toHaveLength(0);
    });
  });

  describe("Full workflow sequence", () => {
    test("happy path: MCC and Finance can progress through the full workflow", () => {
      const sequence: Array<{ role: UserRole; from: JobStage; to: JobStage }> = [
        { role: "MARKETING_CUSTOMER_CARE", from: "VISIT_SCHEDULED", to: "VISIT_COMPLETED" },
        { role: "MARKETING_CUSTOMER_CARE", from: "VISIT_COMPLETED", to: "BRIEF_CONFIRMED" },
        { role: "MANAGEMENT", from: "BRIEF_CONFIRMED", to: "IN_PRODUCTION" },
        { role: "GRAPHIC_DESIGNER", from: "IN_PRODUCTION", to: "READY_FOR_REVIEW" },
        { role: "MANAGEMENT", from: "READY_FOR_REVIEW", to: "APPROVED" },
        { role: "FINANCE", from: "APPROVED", to: "INVOICE_READY" },
        { role: "MARKETING_CUSTOMER_CARE", from: "INVOICE_READY", to: "SENT_TO_CLIENT" },
        { role: "MARKETING_CUSTOMER_CARE", from: "SENT_TO_CLIENT", to: "PAYMENT_REPORTED" },
        { role: "FINANCE", from: "PAYMENT_REPORTED", to: "PAYMENT_VERIFIED" },
        { role: "FINANCE", from: "PAYMENT_VERIFIED", to: "COMPLETED" },
      ];
      sequence.forEach(({ role, from, to }) => {
        expect(canTransition(role, from, to)).toBe(true);
      });
    });
  });
});
