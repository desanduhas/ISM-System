import "@/lib/node-polyfill";
import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: z
    .string()
    .min(6, "New password must be at least 6 characters.")
    .max(128, "New password must be 128 characters or fewer."),
});

export async function POST(request: NextRequest) {
  try {
    const profile = await requireAuth();
    const parsed = ChangePasswordSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid password input." },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = parsed.data;
    if (newPassword === currentPassword) {
      return NextResponse.json(
        { error: "New password must be different from your current password." },
        { status: 400 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const anonKey =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY;

    if (!url || !anonKey) {
      return NextResponse.json(
        { error: "Authentication service is not configured." },
        { status: 500 }
      );
    }

    // Verify the current password without touching browser session cookies.
    const verifier = createSupabaseClient(url, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: verified, error: verifyErr } = await verifier.auth.signInWithPassword({
      email: profile.email,
      password: currentPassword,
    });
    if (verifyErr || !verified.user) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { error: updateErr } = await admin.auth.admin.updateUserById(profile.id, {
      password: newPassword,
    });
    if (updateErr) throw updateErr;

    try {
      await admin.from("audit_logs").insert({
        actor_id: profile.id,
        action: "PASSWORD_CHANGED",
        entity_type: "profiles",
        entity_id: profile.id,
      });
    } catch {
      console.error("Could not record PASSWORD_CHANGED audit event", { actorId: profile.id });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Error && ["UNAUTHORIZED", "ACCOUNT_DISABLED"].includes(err.message)) {
      return NextResponse.json({ error: "Sign in with an active account." }, { status: 401 });
    }
    return NextResponse.json(
      { error: "Could not update password. Please try again." },
      { status: 500 }
    );
  }
}
