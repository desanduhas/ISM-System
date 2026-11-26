"use client";

import { useEffect, useState } from "react";
import { Bell, ChevronRight, KeyRound, LogOut, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import ChangePasswordDialog from "@/components/account/change-password-dialog";
import { createClient } from "@/lib/supabase/client";
import { ROLE_LABELS } from "@/lib/utils";
import type { Profile } from "@/lib/types";

const sections: Record<string, string> = {
  jobs: "Jobs", clients: "Clients", calendar: "Calendar", invoices: "Invoices",
  payments: "Payments", employees: "Employees", notifications: "Notifications",
};

export default function Topbar({ profile, openNav }: { profile: Profile; openNav: () => void }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const router = useRouter();
  const path = usePathname().split("/").filter(Boolean);
  const title = sections[path[0]] || "Overview";
  const supabase = createClient();
  const initials = profile.full_name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  useEffect(() => {
    let mounted = true;
    async function refreshCount() {
      const { count, error } = await supabase.from("notifications").select("id", { count: "exact", head: true })
        .eq("recipient_id", profile.id).eq("is_read", false);
      if (mounted && !error) setUnreadCount(count || 0);
    }
    void refreshCount();
    const channel = supabase.channel("notifications-" + profile.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: "recipient_id=eq." + profile.id }, refreshCount)
      .subscribe();
    return () => { mounted = false; void supabase.removeChannel(channel); };
  }, [profile.id, supabase]);

  async function signOut() {
    setSigningOut(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      router.replace("/login");
      router.refresh();
    } catch {
      toast.error("Could not sign out. Please try again.");
      setSigningOut(false);
    }
  }

  return (
    <header className="workspace-bar">
      <button type="button" className="shell-icon mobile-nav-toggle" onClick={openNav} aria-label="Open navigation" aria-haspopup="dialog"><Menu size={21} /></button>
      <nav className="workspace-path" aria-label="Breadcrumb">
        <Link href="/" className="path-root">Workspace</Link>
        <ChevronRight className="path-root" size={13} aria-hidden="true" />
        {path.length > 1 ? <>
          <Link href={"/" + path[0]}>{title}</Link><ChevronRight size={13} aria-hidden="true" />
          <span aria-current="page">{path[0] === "jobs" ? "Job details" : "Client details"}</span>
        </> : <span aria-current="page">{title}</span>}
      </nav>
      <div className="workspace-account">
        <Link className="shell-icon shell-notifications" href="/notifications" aria-label={unreadCount ? unreadCount + " unread notifications" : "Notifications"} title="Notifications">
          <Bell size={18} strokeWidth={1.7} />
          {unreadCount > 0 && <span className="notification-dot" />}
        </Link>
        <div className="account-person">
          <span className="account-initials" aria-hidden="true">{initials}</span>
          <div className="account-copy"><strong>{profile.full_name}</strong><span>{ROLE_LABELS[profile.role]}</span></div>
        </div>
        <button
          type="button"
          onClick={() => setPasswordDialogOpen(true)}
          className="shell-icon"
          aria-label="Change password"
          title="Change password"
        >
          <KeyRound size={17} strokeWidth={1.6} />
        </button>
        <button type="button" onClick={signOut} disabled={signingOut} className="shell-icon shell-exit" aria-label="Sign out" title="Sign out"><LogOut size={17} strokeWidth={1.6} /></button>
      </div>
      {passwordDialogOpen && (
        <ChangePasswordDialog
          email={profile.email}
          onDismiss={() => setPasswordDialogOpen(false)}
        />
      )}
    </header>
  );
}
