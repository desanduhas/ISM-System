import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Profile } from "@/lib/types";

export async function getAuthUser(): Promise<Profile | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) return null;

    const admin = createAdminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    return (profile as Profile) || null;
  } catch {
    return null;
  }
}

export async function requireAuth(): Promise<Profile> {
  const profile = await getAuthUser();
  if (!profile) throw new Error("UNAUTHORIZED");
  if (!profile.is_active) throw new Error("ACCOUNT_DISABLED");
  return profile;
}
