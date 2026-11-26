import { AlarmClock, BriefcaseBusiness, ClipboardCheck, ReceiptText, Wallet } from "lucide-react";
import type { Profile } from "@/lib/types";
import { DashboardHero, DeadlinePanel, JobPanel, Metrics } from "./dashboard-panels";
import styles from "./dashboard.module.css";

interface ManagementDashboardProps {
  stats: {
    activeJobs: number;
    pendingApproval: number;
    overdueJobs: number;
    pendingInvoices: number;
    pendingPayments: number;
  };
  recentJobs: Array<Record<string, unknown>>;
  upcomingJobs: Array<Record<string, unknown>>;
  profile: Profile;
}

export default function ManagementDashboard({ stats, recentJobs, upcomingJobs, profile }: ManagementDashboardProps) {
  return (
    <div className={styles.dashboard}>
      <DashboardHero profile={profile} title="Studio" emphasis="overview" href="/jobs" action="Open jobs" />
      <Metrics items={[
        { label: "Active jobs", value: stats.activeJobs, icon: BriefcaseBusiness, href: "/jobs?status=active" },
        { label: "Awaiting approval", value: stats.pendingApproval, icon: ClipboardCheck, href: "/jobs?stage=READY_FOR_REVIEW" },
        { label: "Overdue jobs", value: stats.overdueJobs, icon: AlarmClock, href: "/jobs?overdue=1", alert: true },
        { label: "Ready to invoice", value: stats.pendingInvoices, icon: ReceiptText, href: "/jobs?stage=APPROVED" },
        { label: "Payments to verify", value: stats.pendingPayments, icon: Wallet, href: "/payments" },
      ]} />
      <div className={styles.columns}>
        <JobPanel jobs={recentJobs} title="Recent jobs" emptyTitle="No active jobs" emptyDetail="Your next client job will appear here." />
        <DeadlinePanel jobs={upcomingJobs} />
      </div>
    </div>
  );
}
