"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Briefcase, Calendar, Users, FileText,
  CreditCard, Bell, Settings, ChevronRight, Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  roles: UserRole[];
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["MANAGEMENT","MARKETING_CUSTOMER_CARE","GRAPHIC_DESIGNER","CAPTURING","FINANCE"] },
  { href: "/jobs", label: "Jobs", icon: Briefcase, roles: ["MANAGEMENT","MARKETING_CUSTOMER_CARE","GRAPHIC_DESIGNER","CAPTURING","FINANCE"] },
  { href: "/calendar", label: "Calendar", icon: Calendar, roles: ["MANAGEMENT","MARKETING_CUSTOMER_CARE","GRAPHIC_DESIGNER","CAPTURING"] },
  { href: "/clients", label: "Clients", icon: Users, roles: ["MANAGEMENT","MARKETING_CUSTOMER_CARE"] },
  { href: "/invoices", label: "Invoices", icon: FileText, roles: ["MANAGEMENT","FINANCE"] },
  { href: "/payments", label: "Payments", icon: CreditCard, roles: ["MANAGEMENT","FINANCE"] },
  { href: "/notifications", label: "Notifications", icon: Bell, roles: ["MANAGEMENT","MARKETING_CUSTOMER_CARE","GRAPHIC_DESIGNER","CAPTURING","FINANCE"] },
  { href: "/employees", label: "Employees", icon: Settings, roles: ["MANAGEMENT"] },
];

export default function Sidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const visibleItems = NAV_ITEMS.filter(item => item.roles.includes(role));

  return (
    <aside className="w-64 bg-[#0f172a] flex flex-col h-full shrink-0">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center shrink-0">
            <Zap size={16} className="text-white" />
          </div>
          <div>
            <span className="text-white font-bold text-base tracking-tight">ISM Flow</span>
            <p className="text-slate-500 text-xs">Operations</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group",
                isActive
                  ? "bg-purple-600 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-800"
              )}
            >
              <Icon size={18} className="shrink-0" />
              <span className="flex-1">{item.label}</span>
              {isActive && <ChevronRight size={14} />}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-slate-800">
        <p className="text-slate-600 text-xs text-center">ISM Flow v1.0</p>
      </div>
    </aside>
  );
}
