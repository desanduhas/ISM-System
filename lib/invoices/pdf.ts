import React from "react";
import { Document, Page, Text, View, StyleSheet, Font, renderToBuffer } from "@react-pdf/renderer";
import type { Invoice, Client, Job, InvoiceLineItem } from "@/lib/types";
import { calculateInvoiceTotals, type InvoiceTotals } from "./math";

export { calculateInvoiceTotals, type InvoiceTotals };

// Disable hyphenation to prevent Node export resolution issues
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: {
    padding: 36,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#1e293b",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    borderBottomWidth: 2,
    borderBottomColor: "#7c3aed",
    paddingBottom: 16,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 9,
    color: "#64748b",
    marginTop: 2,
  },
  invoiceMetaRight: {
    alignItems: "flex-end",
  },
  invoiceTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#7c3aed",
  },
  invoiceNumber: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#334155",
    marginTop: 2,
  },
  statusBadge: {
    marginTop: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    fontSize: 8,
    fontWeight: "bold",
    color: "#475569",
  },
  sectionTwoCol: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  infoBox: {
    width: "48%",
  },
  boxHeading: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#94a3b8",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  clientName: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#0f172a",
  },
  infoText: {
    fontSize: 9,
    color: "#475569",
    marginTop: 2,
  },
  table: {
    marginTop: 10,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontWeight: "bold",
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  colDesc: { width: "50%" },
  colQty: { width: "15%", textAlign: "right" },
  colPrice: { width: "17%", textAlign: "right" },
  colAmount: { width: "18%", textAlign: "right" },

  totalsContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 24,
  },
  totalsBox: {
    width: "45%",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 4,
    padding: 10,
    backgroundColor: "#fcfdfe",
  },
  totalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
  },
  totalsRowGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    marginTop: 4,
  },
  totalsLabel: {
    fontSize: 9,
    color: "#64748b",
  },
  totalsValue: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#1e293b",
  },
  grandTotalLabel: {
    fontSize: 11,
    fontWeight: "bold",
    color: "#0f172a",
  },
  grandTotalValue: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#7c3aed",
  },
  instructionsBox: {
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 12,
    marginBottom: 16,
  },
  instructionsTitle: {
    fontSize: 9,
    fontWeight: "bold",
    color: "#334155",
    marginBottom: 4,
  },
  instructionsText: {
    fontSize: 8.5,
    color: "#64748b",
    lineHeight: 1.4,
  },
  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "#f1f5f9",
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: "#94a3b8",
  },
});

export interface InvoicePdfData {
  invoice: Invoice;
  client?: Client | null;
  job?: Job | null;
}

export function InvoiceDocument({ invoice, client, job }: InvoicePdfData) {
  const lineItems: InvoiceLineItem[] = invoice.line_items || [];
  const fmt = (n: number) => `LKR ${new Intl.NumberFormat("en-LK", { minimumFractionDigits: 2 }).format(n)}`;

  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: "A4", style: styles.page },
      // Header
      React.createElement(
        View,
        { style: styles.header },
        React.createElement(
          View,
          null,
          React.createElement(Text, { style: styles.brandTitle }, "ISM FLOW"),
          React.createElement(Text, { style: styles.brandSubtitle }, "Marketing Agency Operations"),
          React.createElement(Text, { style: styles.brandSubtitle }, "Colombo, Sri Lanka • contact@ismflow.lk")
        ),
        React.createElement(
          View,
          { style: styles.invoiceMetaRight },
          React.createElement(Text, { style: styles.invoiceTitle }, "INVOICE"),
          React.createElement(Text, { style: styles.invoiceNumber }, invoice.invoice_number || "DRAFT"),
          React.createElement(Text, { style: styles.statusBadge }, invoice.status)
        )
      ),

      // Two column info
      React.createElement(
        View,
        { style: styles.sectionTwoCol },
        React.createElement(
          View,
          { style: styles.infoBox },
          React.createElement(Text, { style: styles.boxHeading }, "BILLED TO"),
          React.createElement(Text, { style: styles.clientName }, client?.company_name || "Valued Client"),
          client?.contact_name ? React.createElement(Text, { style: styles.infoText }, `Attn: ${client.contact_name}`) : null,
          client?.phone ? React.createElement(Text, { style: styles.infoText }, `Phone: ${client.phone}`) : null,
          client?.email ? React.createElement(Text, { style: styles.infoText }, `Email: ${client.email}`) : null,
          client?.billing_address ? React.createElement(Text, { style: styles.infoText }, client.billing_address) : null,
          client?.tax_registration ? React.createElement(Text, { style: styles.infoText }, `Tax ID: ${client.tax_registration}`) : null
        ),
        React.createElement(
          View,
          { style: styles.infoBox },
          React.createElement(Text, { style: styles.boxHeading }, "INVOICE DETAILS"),
          React.createElement(Text, { style: styles.infoText }, `Date: ${invoice.created_at ? new Date(invoice.created_at).toLocaleDateString("en-GB") : "—"}`),
          React.createElement(Text, { style: styles.infoText }, `Due Date: ${invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-GB") : "Upon Receipt"}`),
          job?.job_number ? React.createElement(Text, { style: styles.infoText }, `Job Ref: ${job.job_number} - ${job.title}`) : null
        )
      ),

      // Line items table
      React.createElement(
        View,
        { style: styles.table },
        React.createElement(
          View,
          { style: styles.tableHeader },
          React.createElement(Text, { style: styles.colDesc }, "Description"),
          React.createElement(Text, { style: styles.colQty }, "Qty"),
          React.createElement(Text, { style: styles.colPrice }, "Unit Price (LKR)"),
          React.createElement(Text, { style: styles.colAmount }, "Amount (LKR)")
        ),
        lineItems.map((item, idx) =>
          React.createElement(
            View,
            { key: idx, style: styles.tableRow },
            React.createElement(Text, { style: styles.colDesc }, item.description),
            React.createElement(Text, { style: styles.colQty }, String(item.quantity)),
            React.createElement(Text, { style: styles.colPrice }, new Intl.NumberFormat("en-LK", { minimumFractionDigits: 2 }).format(item.unit_price)),
            React.createElement(Text, { style: styles.colAmount }, new Intl.NumberFormat("en-LK", { minimumFractionDigits: 2 }).format(item.amount))
          )
        )
      ),

      // Totals
      React.createElement(
        View,
        { style: styles.totalsContainer },
        React.createElement(
          View,
          { style: styles.totalsBox },
          React.createElement(
            View,
            { style: styles.totalsRow },
            React.createElement(Text, { style: styles.totalsLabel }, "Subtotal:"),
            React.createElement(Text, { style: styles.totalsValue }, fmt(invoice.subtotal))
          ),
          invoice.discount > 0
            ? React.createElement(
                View,
                { style: styles.totalsRow },
                React.createElement(Text, { style: styles.totalsLabel }, "Discount:"),
                React.createElement(Text, { style: styles.totalsValue }, `-${fmt(invoice.discount)}`)
              )
            : null,
          invoice.tax_amount > 0
            ? React.createElement(
                View,
                { style: styles.totalsRow },
                React.createElement(Text, { style: styles.totalsLabel }, `Tax (${invoice.tax_rate}%):`),
                React.createElement(Text, { style: styles.totalsValue }, fmt(invoice.tax_amount))
              )
            : null,
          React.createElement(
            View,
            { style: styles.totalsRowGrand },
            React.createElement(Text, { style: styles.grandTotalLabel }, "Total Due:"),
            React.createElement(Text, { style: styles.grandTotalValue }, fmt(invoice.total))
          )
        )
      ),

      // Payment instructions
      invoice.payment_instructions
        ? React.createElement(
            View,
            { style: styles.instructionsBox },
            React.createElement(Text, { style: styles.instructionsTitle }, "Payment Instructions"),
            React.createElement(Text, { style: styles.instructionsText }, invoice.payment_instructions)
          )
        : null,

      // Footer
      React.createElement(
        View,
        { style: styles.footer },
        React.createElement(Text, { style: styles.footerText }, "Thank you for choosing ISM Flow! For questions, email accounts@ismflow.lk")
      )
    )
  );
}

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(InvoiceDocument(data));
}
