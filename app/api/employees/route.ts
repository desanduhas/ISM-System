import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";

const CreateEmployeeSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  full_name: z.string().min(1, "Full name is required").max(100),
  role: z.enum([
    "MANAGEMENT",
    "MARKETING_CUSTOMER_CARE",
    "GRAPHIC_DESIGNER",
    "CAPTURING",
    "FINANCE",
  ]),
  department_id: z.string().uuid().nullable().optional(),
  whatsapp_number: z.string().nullable().optional(),
});

const UpdateEmployeeSchema = z.object({
  id: z.string().uuid(),
  full_name: z.string().min(1).optional(),
  role: z
    .enum([
      "MANAGEMENT",
      "MARKETING_CUSTOMER_CARE",
      "GRAPHIC_DESIGNER",
      "CAPTURING",
      "FINANCE",
    ])
    .optional(),
  department_id: z.string().uuid().nullable().optional(),
  whatsapp_number: z.string().nullable().optional(),
  is_active: z.boolean().optional(),
});

export async function GET() {
  try {
    const profile = await requireAuth();
    if (profile.role !== "MANAGEMENT") {
      return NextResponse.json(
        { error: "Forbidden: Only management can access employee records" },
        { status: 403 }
      );
    }

    const admin = createAdminClient();

    // 1. Fetch all profiles
    const { data: profiles, error: profilesErr } = await admin
      .from("profiles")
      .select(`
        id,
        email,
        full_name,
        role,
        department_id,
        whatsapp_number,
        avatar_url,
        is_active,
        notification_preferences,
        created_at,
        updated_at,
        department:departments(id, name)
      `)
      .order("full_name", { ascending: true });

    if (profilesErr) throw profilesErr;

    // 2. Fetch departments
    const { data: departments, error: deptErr } = await admin
      .from("departments")
      .select("*")
      .order("name", { ascending: true });

    if (deptErr) throw deptErr;

    // 3. Fetch active job count per employee
    const { data: activeJobs, error: jobsErr } = await admin
      .from("jobs")
      .select("assigned_to")
      .not("current_stage", "in", '("COMPLETED","CANCELLED")')
      .not("assigned_to", "is", null);

    if (jobsErr) throw jobsErr;

    const workloadCounts: Record<string, number> = {};
    activeJobs?.forEach((job) => {
      if (job.assigned_to) {
        workloadCounts[job.assigned_to] = (workloadCounts[job.assigned_to] || 0) + 1;
      }
    });

    const employeesWithStats = (profiles || []).map((emp) => ({
      ...emp,
      active_jobs_count: workloadCounts[emp.id] || 0,
    }));

    return NextResponse.json({
      data: employeesWithStats,
      departments: departments || [],
    });
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
    const currentProfile = await requireAuth();
    if (currentProfile.role !== "MANAGEMENT") {
      return NextResponse.json(
        { error: "Forbidden: Only management can add employees" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = CreateEmployeeSchema.parse(body);

    const admin = createAdminClient();

    // Create auth user
    const { data: authData, error: authErr } = await admin.auth.admin.createUser({
      email: validated.email,
      password: validated.password,
      email_confirm: true,
      user_metadata: {
        full_name: validated.full_name,
        role: validated.role,
      },
    });

    if (authErr) throw authErr;
    if (!authData.user) throw new Error("Failed to create user");

    // Upsert profile to set all fields accurately
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .upsert({
        id: authData.user.id,
        email: validated.email,
        full_name: validated.full_name,
        role: validated.role,
        department_id: validated.department_id || null,
        whatsapp_number: validated.whatsapp_number || null,
        is_active: true,
      })
      .select(`
        id,
        email,
        full_name,
        role,
        department_id,
        whatsapp_number,
        avatar_url,
        is_active,
        notification_preferences,
        created_at,
        updated_at,
        department:departments(id, name)
      `)
      .single();

    if (profileErr) throw profileErr;

    // Log to audit_logs
    await admin.from("audit_logs").insert({
      actor_id: currentProfile.id,
      action: "EMPLOYEE_INVITED",
      entity_type: "profiles",
      entity_id: authData.user.id,
      new_values: {
        email: validated.email,
        full_name: validated.full_name,
        role: validated.role,
        department_id: validated.department_id,
      },
    });

    return NextResponse.json({ data: profile }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Internal error";
    if (message === "UNAUTHORIZED" || message === "ACCOUNT_DISABLED") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const currentProfile = await requireAuth();
    if (currentProfile.role !== "MANAGEMENT") {
      return NextResponse.json(
        { error: "Forbidden: Only management can update employees" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const validated = UpdateEmployeeSchema.parse(body);

    const admin = createAdminClient();

    // Get previous state for audit log
    const { data: oldProfile, error: getErr } = await admin
      .from("profiles")
      .select("*")
      .eq("id", validated.id)
      .single();

    if (getErr || !oldProfile) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Prepare update payload
    const updates: Record<string, unknown> = {};
    if (validated.full_name !== undefined) updates.full_name = validated.full_name;
    if (validated.role !== undefined) updates.role = validated.role;
    if (validated.department_id !== undefined) updates.department_id = validated.department_id;
    if (validated.whatsapp_number !== undefined) updates.whatsapp_number = validated.whatsapp_number;
    if (validated.is_active !== undefined) updates.is_active = validated.is_active;

    const { data: updatedProfile, error: updateErr } = await admin
      .from("profiles")
      .update(updates)
      .eq("id", validated.id)
      .select(`
        id,
        email,
        full_name,
        role,
        department_id,
        whatsapp_number,
        avatar_url,
        is_active,
        notification_preferences,
        created_at,
        updated_at,
        department:departments(id, name)
      `)
      .single();

    if (updateErr) throw updateErr;

    // Sync auth metadata if name or role changed
    if (validated.full_name || validated.role) {
      await admin.auth.admin
        .updateUserById(validated.id, {
          user_metadata: {
            ...(validated.full_name ? { full_name: validated.full_name } : {}),
            ...(validated.role ? { role: validated.role } : {}),
          },
        })
        .catch(() => {});
    }

    // Audit log
    await admin.from("audit_logs").insert({
      actor_id: currentProfile.id,
      action: "EMPLOYEE_UPDATED",
      entity_type: "profiles",
      entity_id: validated.id,
      old_values: oldProfile,
      new_values: updates,
    });

    return NextResponse.json({ data: updatedProfile });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation error", details: err.errors }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Internal error";
    if (message === "UNAUTHORIZED" || message === "ACCOUNT_DISABLED") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
