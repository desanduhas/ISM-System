"use client";

import { useEffect, useRef } from "react";
import type { Profile } from "@/lib/types";
import Sidebar from "./sidebar";
import Topbar from "./topbar";

export default function WorkspaceShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const mobileNav = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 960px)");
    function closeOnDesktop() {
      if (desktop.matches && mobileNav.current?.open) mobileNav.current.close();
    }
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#workspace-main">Skip to content</a>
      <div className="workspace-desktop-nav"><Sidebar role={profile.role} /></div>
      <dialog ref={mobileNav} className="workspace-mobile-nav" aria-label="Workspace navigation" onClick={(event) => {
        if (event.target === event.currentTarget) mobileNav.current?.close();
      }}>
        <Sidebar role={profile.role} dismiss={() => mobileNav.current?.close()} />
      </dialog>
      <div className="workspace-column">
        <Topbar profile={profile} openNav={() => mobileNav.current?.showModal()} />
        <main id="workspace-main" tabIndex={-1} className="workspace-content">{children}</main>
      </div>
    </div>
  );
}
