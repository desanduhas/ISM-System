import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";

const CreateClientSchema = z.object({
  company_name: z.string().min(1).max(200),
  contact_name: z.string().min(1).max(100),
  phone: z.string().optional(),
  whatsapp_number: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  billing_address: z.string().optional(),
  tax_registration: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const profile = await requireAuth();
    const admin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search");

    let query = admin
      .from("clients")
      .select("*", { count: "exact" })
      .eq("is_active", true)
      .order("company_name");

    if (search) {
      query = query.or(`company_name.ilike.%${search}%,contact_name.ilike.%${search}%`);
    }

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data, count });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireAuth();
    if (!["MANAGEMENT","MARKETING_CUSTOMER_CARE"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const validated = CreateClientSchema.parse(body);
    const admin = createAdminClient();

    const { data: client, error } = await admin
      .from("clients")
      .insert({ ...validated, created_by: profile.id })
      .select()
      .single();

    if (error) throw error;

    await admin.from("audit_logs").insert({
      actor_id: profile.id,
      action: "CLIENT_CREATED",
      entity_type: "clients",
      entity_id: client.id,
      new_values: validated,
    });

    return NextResponse.json({ data: client }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
