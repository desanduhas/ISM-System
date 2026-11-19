import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateInvoicePdf } from "@/lib/invoices/pdf";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const profile = await requireAuth();
    const { id } = await context.params;
    const admin = createAdminClient();

    const { data: invoice, error } = await admin
      .from("invoices")
      .select("*, client:clients(*), job:jobs(*)")
      .eq("id", id)
      .single();

    if (error || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Role check: Management, Finance, or MCC
    if (!["MANAGEMENT", "FINANCE", "MARKETING_CUSTOMER_CARE"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const pdfBuffer = await generateInvoicePdf({
      invoice,
      client: invoice.client,
      job: invoice.job,
    });

    const fileName = `invoice-${invoice.invoice_number || invoice.id}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
