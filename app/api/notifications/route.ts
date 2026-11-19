import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: NextRequest) {
  try {
    const profile = await requireAuth();
    const admin = createAdminClient();
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "true";

    let query = admin
      .from("notifications")
      .select("*, job:jobs(id, job_number, title, current_stage)", { count: "exact" })
      .eq("recipient_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (unreadOnly) query = query.eq("is_read", false);

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json({ data, count });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const profile = await requireAuth();
    const body = await request.json();
    const admin = createAdminClient();

    if (body.mark_all) {
      await admin
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("recipient_id", profile.id)
        .eq("is_read", false);
    } else if (body.id) {
      await admin
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", body.id)
        .eq("recipient_id", profile.id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
