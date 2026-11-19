export interface InvoiceTotals {
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

export function calculateInvoiceTotals(
  lineItems: Array<{ amount?: number; quantity: number; unit_price: number }>,
  discount = 0,
  taxRate = 0
): InvoiceTotals {
  const subtotal = lineItems.reduce((sum, item) => {
    const itemAmount = typeof item.amount === "number" ? item.amount : item.quantity * item.unit_price;
    return sum + itemAmount;
  }, 0);

  const discountedSubtotal = Math.max(0, subtotal - discount);
  const taxAmount = (discountedSubtotal * taxRate) / 100;
  const total = discountedSubtotal + taxAmount;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount: Math.round(discount * 100) / 100,
    taxRate,
    taxAmount: Math.round(taxAmount * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}
