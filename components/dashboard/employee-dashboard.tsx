import { AlarmClock, Bell, BriefcaseBusiness, ClipboardCheck, Layers } from "lucide-react";
import type { Profile } from "@/lib/types";
import {
  DashboardHero, DeadlinePanel, EmptyState, JobPanel, Metrics, PanelHeading, shortDate,
} from "./dashboard-panels";
import styles from "./dashboard.module.css";

interface EmployeeDashboardProps {
  profile: Profile;
  assignedJobs: Array<Record<string, unknown>>;
  notifications: Array<Record<string, unknown>>;
}

export default function EmployeeDashboard({ profile, assignedJobs, notifications }: EmployeeDashboardProps) {
  const now = Date.now();
  const datedJobs = assignedJobs.filter((job) => typeof job.deadline === "string");
  const futureJobs = datedJobs
    .filter((job) => Date.parse(job.deadline as string) >= now)
    .sort((first, second) => Date.parse(first.deadline as string) - Date.parse(second.deadline as string))
    .slice(0, 4);

  return (
    <div className={styles.dashboard}>
      <DashboardHero profile={profile} title="My" emphasis="workspace" href="/calendar" action="Open calendar" />
      <Metrics items={[
        { label: "Active assignments", value: assignedJobs.length, icon: BriefcaseBusiness },
        { label: "In production", value: assignedJobs.filter((job) => job.current_stage === "IN_PRODUCTION").length, icon: Layers },
        { label: "Awaiting review", value: assignedJobs.filter((job) => job.current_stage === "READY_FOR_REVIEW").length, icon: ClipboardCheck },
        { label: "Overdue jobs", value: datedJobs.filter((job) => Date.parse(job.deadline as string) < now).length, icon: AlarmClock, alert: true },
      ]} />
      <div className={styles.columns}>
        <div className={styles.stack}>
          <JobPanel jobs={assignedJobs.slice(0, 6)} title="My assignments" emptyTitle="No active assignments" emptyDetail="Jobs assigned to you will appear here." />
          <section className={styles.panel}>
            <PanelHeading title="Recent notifications" href="/notifications" action="View all" />
            {notifications.length ? (
              <ul className={styles.notifications}>
                {notifications.map((item) => (
                  <li key={item.id as string}>
                    <Bell size={16} aria-hidden="true" />
                    <div>
                      <strong>{item.title as string}</strong>
                      <p>{item.body as string}</p>
                    </div>
                    {typeof item.created_at === "string" && <time dateTime={item.created_at}>{shortDate(item.created_at)}</time>}
                  </li>
                ))}
              </ul>
            ) : <EmptyState icon={Bell} title="No unread notifications" />}
          </section>
        </div>
        <DeadlinePanel jobs={futureJobs} />
      </div>
    </div>
  );
}
