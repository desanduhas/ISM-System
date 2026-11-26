import Link from "next/link";
import { ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronRight, FolderOpen, type LucideIcon } from "lucide-react";
import type { JobStage, Profile } from "@/lib/types";
import { STAGE_LABELS } from "@/lib/utils";
import styles from "./dashboard.module.css";

const timeZone = "Asia/Colombo";
const longDate = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone });
const calendarDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone });
const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", timeZone });
const month = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone });
const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone });

export function shortDate(value: string) {
  return calendarDate.format(new Date(value));
}

interface DashboardHeroProps {
  profile: Profile;
  title: string;
  emphasis: string;
  href: string;
  action: string;
}

export function DashboardHero({ profile, title, emphasis, href, action }: DashboardHeroProps) {
  const firstName = profile.full_name.trim().split(/\s+/)[0];
  const today = new Date();
  return (
    <header className={styles.hero}>
      <div className={styles.heroContent}>
        <time dateTime={today.toISOString()} className={styles.heroDate}>{longDate.format(today)}</time>
        <h1>{title} <em>{emphasis}</em></h1>
        <p>{firstName ? `Welcome back, ${firstName}.` : "Welcome back."}</p>
        <Link className={styles.heroAction} href={href}>{action} <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
    </header>
  );
}

interface Metric {
  label: string;
  value: number;
  icon: LucideIcon;
  href?: string;
  alert?: boolean;
}

export function Metrics({ items }: { items: Metric[] }) {
  return (
    <div className={styles.metrics} data-count={items.length} aria-label="Workload summary">
      {items.map(({ label, value, icon: Icon, href, alert }) => {
        const content = (
          <>
            <div className={styles.metricTop}>
              <Icon size={19} strokeWidth={1.6} aria-hidden="true" />
              {href && <ArrowUpRight className={styles.metricArrow} size={13} aria-hidden="true" />}
            </div>
            <strong>{value.toLocaleString("en-GB")}</strong>
            <span>{label}</span>
          </>
        );
        return href ? (
          <Link key={label} className={styles.metric} data-alert={alert && value > 0} href={href}>{content}</Link>
        ) : (
          <div key={label} className={styles.metric} data-alert={alert && value > 0}>{content}</div>
        );
      })}
    </div>
  );
}

export function PanelHeading({ title, href, action }: { title: string; href: string; action: string }) {
  return (
    <div className={styles.panelHeading}>
      <h2>{title}</h2>
      <Link href={href} aria-label={`${action} – ${title}`}>{action} <ArrowUpRight size={13} aria-hidden="true" /></Link>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, detail }: { icon: LucideIcon; title: string; detail?: string }) {
  return (
    <div className={styles.empty}>
      <span className={styles.emptyIcon}><Icon size={24} strokeWidth={1.35} aria-hidden="true" /></span>
      <strong>{title}</strong>
      {detail && <p>{detail}</p>}
    </div>
  );
}

interface JobPanelProps {
  jobs: Array<Record<string, unknown>>;
  title: string;
  emptyTitle: string;
  emptyDetail: string;
}

function jobMeta(job: Record<string, unknown>) {
  const client = job.client as { company_name?: string } | null;
  return [job.job_number, client?.company_name].filter(Boolean).join(" · ");
}

export function JobPanel({ jobs, title, emptyTitle, emptyDetail }: JobPanelProps) {
  return (
    <section className={styles.panel}>
      <PanelHeading title={title} href="/jobs" action="All jobs" />
      {jobs.length ? (
        <ul className={styles.jobs}>
          {jobs.map((job) => {
            const stage = job.current_stage as JobStage;
            return (
              <li key={job.id as string}>
                <Link href={`/jobs/${job.id}`} className={styles.jobRow}>
                  <div className={styles.jobText}>
                    <strong>{job.title as string}</strong>
                    <small>{jobMeta(job)}</small>
                    {typeof job.deadline === "string" && <time className={styles.jobDate} dateTime={job.deadline}>Due {shortDate(job.deadline)}</time>}
                  </div>
                  <span className={styles.stage} data-stage={stage}>{STAGE_LABELS[stage] || stage}</span>
                  <ChevronRight size={14} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : <EmptyState icon={FolderOpen} title={emptyTitle} detail={emptyDetail} />}
    </section>
  );
}

function WeekStrip() {
  const today = new Date();
  const days = Array.from({ length: 7 }, (_, index) => new Date(today.getTime() + index * 86_400_000));
  return (
    <div className={styles.week}>
      <div className={styles.weekCaption}>
        <CalendarDays size={14} aria-hidden="true" />
        {calendarDate.formatRange(today, days[6])}
      </div>
      <ol className={styles.weekDays}>
        {days.map((date, index) => (
          <li key={date.toISOString()} aria-label={longDate.format(date)} aria-current={index === 0 ? "date" : undefined}>
            <span>{weekday.format(date)}</span>
            <strong>{day.format(date)}</strong>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function DeadlinePanel({ jobs }: { jobs: Array<Record<string, unknown>> }) {
  return (
    <section className={styles.panel}>
      <PanelHeading title="Upcoming deadlines" href="/calendar" action="Calendar" />
      <WeekStrip />
      {jobs.length ? (
        <ul className={styles.deadlines}>
          {jobs.map((job) => {
            const due = new Date(job.deadline as string);
            return (
              <li key={job.id as string}>
                <Link href={`/jobs/${job.id}`}>
                  <time dateTime={job.deadline as string} className={styles.dateTile}>
                    <span>{month.format(due)}</span><strong>{day.format(due)}</strong>
                  </time>
                  <div className={styles.jobText}>
                    <strong>{job.title as string}</strong>
                    <small>{jobMeta(job)}</small>
                  </div>
                  <ChevronRight size={14} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : <p className={styles.noDeadlines}><Check size={16} aria-hidden="true" /> No upcoming deadlines</p>}
    </section>
  );
}
