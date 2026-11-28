"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, BriefcaseBusiness, CalendarDays, ContactRound, FileText, Globe2, LayoutGrid, MessageCircle, UsersRound, WalletCards, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { UserRole } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles?: UserRole[];
}

const groups: { label: string; items: NavItem[] }[] = [
  { label: "Workspace", items: [
    { href: "/", label: "Overview", icon: LayoutGrid },
    { href: "/jobs", label: "Jobs", icon: BriefcaseBusiness },
    { href: "/calendar", label: "Calendar", icon: CalendarDays, roles: ["MANAGEMENT", "MARKETING_CUSTOMER_CARE", "GRAPHIC_DESIGNER", "CAPTURING"] },
    { href: "/clients", label: "Clients", icon: ContactRound, roles: ["MANAGEMENT", "MARKETING_CUSTOMER_CARE"] },
  ] },
  { label: "Administration", items: [
    { href: "/invoices", label: "Invoices", icon: FileText, roles: ["MANAGEMENT", "FINANCE"] },
    { href: "/payments", label: "Payments", icon: WalletCards, roles: ["MANAGEMENT", "FINANCE"] },
    { href: "/employees", label: "Employees", icon: UsersRound, roles: ["MANAGEMENT"] },
    { href: "/whatsapp-setup", label: "WhatsApp Setup", icon: MessageCircle, roles: ["MANAGEMENT"] },
  ] },
];

export default function Sidebar({ role, dismiss }: { role: UserRole; dismiss?: () => void }) {
  const currentPath = usePathname();
  const notificationActive = currentPath === "/notifications";
  return (
    <aside className="workspace-rail">
      <div className="rail-masthead">
        <Link href="/" onClick={dismiss} aria-label="ISM Flow overview">
          <Image src="/brand/ism-mark.png" width={536} height={277} alt="I Shop Marketing" className="rail-logo" priority />
        </Link>
        {dismiss && <button type="button" className="rail-close" onClick={dismiss} aria-label="Close navigation"><X size={21} /></button>}
      </div>
      <nav className="rail-nav" aria-label="Main navigation">
        {groups.map((group) => {
          const items = group.items.filter((item) => !item.roles || item.roles.includes(role));
          if (!items.length) return null;
          return (
            <div className="rail-group" key={group.label}>
              <p>{group.label}</p>
              {items.map(({ href, label, icon: Icon }) => {
                const active = currentPath === href || (href !== "/" && currentPath.startsWith(href + "/"));
                return (
                  <Link key={href} href={href} onClick={dismiss} aria-current={active ? "page" : undefined} className="rail-link">
                    <Icon size={18} strokeWidth={1.6} />
                    {label}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div className="rail-footer">
        <Link className="rail-link" href="/notifications" onClick={dismiss} aria-current={notificationActive ? "page" : undefined}>
          <Bell size={17} strokeWidth={1.6} /> Notifications
        </Link>
        <a className="rail-site" href="https://ishopmarketing.com/" target="_blank" rel="noreferrer">
          Agency website <Globe2 size={14} aria-hidden="true" />
        </a>
      </div>
    </aside>
  );
}
