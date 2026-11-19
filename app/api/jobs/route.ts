import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";

const CreateJobSchema = z.object({
  title: z.string().min(1).max(200),
  job_type: z.enum(["Graphic Design","Photography","Videography","Capturing","Digital Marketing","Social Media Management","Content Creation","Customer Care","Other"]),
  client_id: z.string().uuid(),
  assigned_to: z.string().uuid().optional(),
  department_id: z.string().uuid().optional(),
  visit_date: z.string().datetime().optional(),
  visit_location: z.string().optional(),
  brief: z.string().optional(),
  deadline: z.string().datetime().optional(),
  agreed_price: z.number().positive().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const profile = await requireAuth();
    const admin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const stage = searchParams.get("stage");
    const clientId = searchParams.get("client_id");
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "50");

    let query = admin
      .from("jobs")
      .select(`*, client:clients(id, company_name, contact_name, whatsapp_number), assigned_profile:profiles!jobs_assigned_to_fkey(id, full_name, role)`, { count: "exact" })
      .order("created_at", { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);

    // Role-based filtering
    if (profile.role !== "MANAGEMENT") {
      if (profile.role === "FINANCE") {
        query = query.in("current_stage", ["APPROVED","INVOICE_READY","SENT_TO_CLIENT","PAYMENT_REPORTED","PAYMENT_VERIFIED","COMPLETED"]);
      } else {
        query = query.eq("assigned_to", profile.id);
      }
    }

    if (stage) query = query.eq("current_stage", stage);
    if (clientId) query = query.eq("client_id", clientId);

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data, count, page, pageSize });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    if (message === "UNAUTHORIZED" || message === "ACCOUNT_DISABLED") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const profile = await requireAuth();
    if (profile.role !== "MANAGEMENT") {
      return NextResponse.json({ error: "Forbidden: Only management can create jobs" }, { status: 403 });
    }

    const body = await request.json();
    const validated = CreateJobSchema.parse(body);
    const admin = createAdminClient();

    const { data: job, error } = await admin
      .from("jobs")
      .insert({
        ...validated,
        job_number: "", // Will be set by trigger
        current_stage: "VISIT_SCHEDULED",
        created_by: profile.id,
      })
      .select(`*, client:clients(id, company_name, contact_name, whatsapp_number)`)
      .single();

    if (error) throw error;

    // Record stage history
    await admin.from("job_stage_history").insert({
      job_id: job.id,
      from_stage: null,
      to_stage: "VISIT_SCHEDULED",
      changed_by: profile.id,
      is_override: false,
    });

    // Record audit log
    await admin.from("audit_logs").insert({
      actor_id: profile.id,
      action: "JOB_CREATED",
      entity_type: "jobs",
      entity_id: job.id,
      new_values: validated,
      ip_address: request.headers.get("x-forwarded-for"),
      user_agent: request.headers.get("user-agent"),
    });

    return NextResponse.json({ data: job }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
