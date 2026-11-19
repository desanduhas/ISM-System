import { requireAuth } from "@/lib/auth/get-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import NotificationsClient from "./notifications-client";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  let profile;
  try {
    profile = await requireAuth();
  } catch {
    redirect("/login");
  }

  const admin = createAdminClient();
  const { data: notifications } = await admin
    .from("notifications")
    .select("*, job:jobs(id, job_number, title, current_stage)")
    .eq("recipient_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <NotificationsClient
      initialNotifications={notifications || []}
      profile={profile}
    />
  );
}
