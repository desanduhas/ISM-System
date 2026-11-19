import { calculateInvoiceTotals } from "@/lib/invoices/math";
import type { InvoiceStatus } from "@/lib/types";

describe("Invoice Math & Calculations", () => {
  test("calculates subtotal correctly from multiple line items", () => {
    const lineItems = [
      { description: "Logo Design", quantity: 1, unit_price: 35000 },
      { description: "Social Media Posts", quantity: 5, unit_price: 4000 },
    ];
    const { subtotal } = calculateInvoiceTotals(lineItems);
    expect(subtotal).toBe(55000);
  });

  test("calculates discount deduction accurately", () => {
    const lineItems = [{ description: "Video Production", quantity: 1, unit_price: 100000 }];
    const { subtotal, discount, total } = calculateInvoiceTotals(lineItems, 10000, 0);
    expect(subtotal).toBe(100000);
    expect(discount).toBe(10000);
    expect(total).toBe(90000);
  });

  test("calculates tax on discounted subtotal", () => {
    const lineItems = [{ description: "Brand Strategy", quantity: 1, unit_price: 100000 }];
    // Subtotal 100,000 - 20,000 discount = 80,000. 15% tax on 80,000 = 12,000. Total = 92,000.
    const { subtotal, discount, taxRate, taxAmount, total } = calculateInvoiceTotals(lineItems, 20000, 15);
    expect(subtotal).toBe(100000);
    expect(discount).toBe(20000);
    expect(taxRate).toBe(15);
    expect(taxAmount).toBe(12000);
    expect(total).toBe(92000);
  });

  test("handles zero discount and zero tax", () => {
    const lineItems = [{ description: "Consultation", quantity: 2, unit_price: 15000 }];
    const { subtotal, discount, taxAmount, total } = calculateInvoiceTotals(lineItems, 0, 0);
    expect(subtotal).toBe(30000);
    expect(discount).toBe(0);
    expect(taxAmount).toBe(0);
    expect(total).toBe(30000);
  });

  test("prevents negative totals when discount exceeds subtotal", () => {
    const lineItems = [{ description: "Mini Task", quantity: 1, unit_price: 5000 }];
    const { total } = calculateInvoiceTotals(lineItems, 10000, 0);
    expect(total).toBe(0);
  });
});

describe("Invoice Status Transitions", () => {
  const VALID_STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
    DRAFT: ["ISSUED", "CANCELLED"],
    ISSUED: ["SENT", "PAID", "CANCELLED"],
    SENT: ["PAID", "CANCELLED"],
    PAID: [],
    CANCELLED: [],
  };

  function canTransitionInvoice(current: InvoiceStatus, next: InvoiceStatus): boolean {
    return VALID_STATUS_TRANSITIONS[current]?.includes(next) ?? false;
  }

  test("allows DRAFT to transition to ISSUED or CANCELLED", () => {
    expect(canTransitionInvoice("DRAFT", "ISSUED")).toBe(true);
    expect(canTransitionInvoice("DRAFT", "CANCELLED")).toBe(true);
    expect(canTransitionInvoice("DRAFT", "PAID")).toBe(false);
  });

  test("allows ISSUED to transition to SENT or PAID", () => {
    expect(canTransitionInvoice("ISSUED", "SENT")).toBe(true);
    expect(canTransitionInvoice("ISSUED", "PAID")).toBe(true);
  });

  test("allows SENT to transition to PAID", () => {
    expect(canTransitionInvoice("SENT", "PAID")).toBe(true);
  });

  test("PAID and CANCELLED are terminal states", () => {
    expect(canTransitionInvoice("PAID", "DRAFT")).toBe(false);
    expect(canTransitionInvoice("PAID", "CANCELLED")).toBe(false);
    expect(canTransitionInvoice("CANCELLED", "DRAFT")).toBe(false);
  });
});
