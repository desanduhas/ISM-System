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

const DeleteEmployeeSchema = UpdateEmployeeSchema.pick({ id: true });

export async function DELETE(request: NextRequest) {
  try {
    const actor = await requireAuth();
    if (actor.role !== "MANAGEMENT") {
      return NextResponse.json({ error: "Only management can delete employees." }, { status: 403 });
    }

    const parsed = DeleteEmployeeSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Select a valid employee." }, { status: 400 });
    }
    const id = parsed.data.id.toLowerCase();
    if (id === actor.id.toLowerCase()) {
      return NextResponse.json({ error: "You cannot delete your own account." }, { status: 409 });
    }

    const admin = createAdminClient();
    const { data: employee, error: readError } = await admin
      .from("profiles").select("id, full_name, role").eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!employee) {
      return NextResponse.json({ error: "Employee no longer exists." }, { status: 404 });
    }

    const countOptions = { count: "exact", head: true } as const;
    const [assignedJobs, ...history] = await Promise.all([
      admin.from("jobs").select("id", countOptions).eq("assigned_to", id)
        .not("current_stage", "in", "(COMPLETED,CANCELLED)"),
      admin.from("job_assignments").select("id", countOptions).eq("assigned_to", id),
      admin.from("job_comments").select("id", countOptions).eq("author_id", id),
      admin.from("job_approvals").select("id", countOptions).eq("reviewed_by", id),
      admin.from("payments").select("id", countOptions).eq("reported_by", id),
    ]);
    if ([assignedJobs, ...history].some(result => result.error || result.count == null)) {
      throw new Error("Employee reference check failed");
    }
    if (assignedJobs.count) {
      return NextResponse.json({ error: "Reassign this employee’s active jobs before deleting their account." }, { status: 409 });
    }
    if (history.some(result => result.count)) {
      return NextResponse.json({ error: "This employee has assignment, review, comment or payment history. Set them to Inactive to remove access and keep those records." }, { status: 409 });
    }

    // Auth owns the account. The profile and personal notifications follow its foreign-key cascade.
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error?.status === 404 || error?.code === "user_not_found") {
      return NextResponse.json({ error: "Employee no longer exists." }, { status: 404 });
    }
    if (error) throw error;

    // The auth deletion is committed at this point even if the audit service is unavailable.
    try {
      const audit = await admin.from("audit_logs").insert({
        actor_id: actor.id, action: "EMPLOYEE_DELETED", entity_type: "profiles",
        entity_id: id, old_values: employee,
      });
      if (audit.error) throw audit.error;
    } catch {
      console.error("Could not record EMPLOYEE_DELETED audit event", { actorId: actor.id, employeeId: id });
      return NextResponse.json({ success: true, warning: "Employee deleted, but the audit entry could not be saved." });
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && ["UNAUTHORIZED", "ACCOUNT_DISABLED"].includes(err.message)) {
      return NextResponse.json({ error: "Sign in with an active management account." }, { status: 401 });
    }
    return NextResponse.json({ error: "Could not delete the employee. Refresh the list and try again." }, { status: 500 });
  }
}

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
