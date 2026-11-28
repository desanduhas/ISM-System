import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/get-user";
import {
  createMissingWhatsAppTemplates,
  listWhatsAppTemplates,
} from "@/lib/whatsapp/template-manager";
import { TEMPLATE_DOCS } from "@/lib/whatsapp/templates";

async function requireManagement() {
  const profile = await requireAuth();
  if (profile.role !== "MANAGEMENT") throw new Error("FORBIDDEN");
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "WhatsApp template request failed";
  const status = message === "UNAUTHORIZED" || message === "ACCOUNT_DISABLED"
    ? 401
    : message === "FORBIDDEN" ? 403 : 502;
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    await requireManagement();
    const templates = await listWhatsAppTemplates();
    const requiredNames = Object.keys(TEMPLATE_DOCS);
    return NextResponse.json({
      templates: templates.filter(template => requiredNames.includes(template.name)),
      required: requiredNames,
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST() {
  try {
    await requireManagement();
    const results = await createMissingWhatsAppTemplates();
    return NextResponse.json({ results });
  } catch (error) {
    return errorResponse(error);
  }
}
