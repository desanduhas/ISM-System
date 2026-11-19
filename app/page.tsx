"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Bell, BriefcaseBusiness, CalendarDays, Check, ChevronDown, ChevronRight, CircleDollarSign,
  Clock3, FileText, LayoutDashboard, Link2, ListFilter, MapPin, Menu, MessageCircleMore,
  MoreHorizontal, Plus, Search, Settings, Sparkles, Users, X, Zap,
} from "lucide-react";

type Job = {
  id: string; client: string; title: string; type: string; stage: string; date: string; time: string;
  location: string; contactName: string; contactPhone: string; brief: string; assignedRole: string;
  owner: string; price: number; filesUrl: string | null; invoiceNo: string | null;
  paymentStatus: string; updatedAt: string;
};

const stages = ["visit", "brief", "production", "review", "approved", "invoice", "sent", "payment", "closed"];
const stageNames: Record<string, string> = { visit: "Visit scheduled", brief: "Brief received", production: "In production", review: "Ready for review", approved: "Approved", invoice: "Invoice ready", sent: "Sent to client", payment: "Payment check", closed: "Completed" };
const roleNames: Record<string, string> = { management: "Management", marketing: "Marketing & Customer Care", graphics: "Graphic Designer", capturing: "Capturing Team", finance: "Finance" };
const rolePeople: Record<string, string> = { management: "Nadeesha", marketing: "Dinithi", graphics: "Kavindu", capturing: "Sahan", finance: "Hasini" };
const stageColors: Record<string, string> = { visit: "blue", brief: "violet", production: "amber", review: "orange", approved: "emerald", invoice: "cyan", sent: "indigo", payment: "pink", closed: "slate" };

function money(value: number) { return `LKR ${new Intl.NumberFormat("en-LK").format(value)}`; }
function dayLabel(value: string) { return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", { month: "short", day: "numeric" }); }

export default function Home() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState("management");
  const [view, setView] = useState<"overview" | "jobs" | "calendar" | "team">("overview");
  const [selected, setSelected] = useState<Job | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);

  const load = () => fetch("/api/jobs").then(r => r.json()).then(setJobs).catch(() => setJobs([])).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(null), 3200); return () => clearTimeout(timer); }, [toast]);

  const visible = useMemo(() => jobs.filter(j => `${j.id} ${j.client} ${j.title} ${j.type}`.toLowerCase().includes(query.toLowerCase())), [jobs, query]);
  const active = jobs.filter(j => j.stage !== "closed");
  const pendingMine = jobs.filter(j => j.assignedRole === role && j.stage !== "closed");
  const revenue = jobs.filter(j => j.stage === "closed").reduce((sum, j) => sum + j.price, 0);

  async function patchJob(id: string, update: Partial<Job>, notice: string) {
    const response = await fetch("/api/jobs", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...update }) });
    const row = await response.json();
    setJobs(list => list.map(j => j.id === id ? row : j)); setSelected(row); setToast(notice);
  }

  function advance(job: Job) {
    const index = stages.indexOf(job.stage); if (index === stages.length - 1) return;
    const next = stages[index + 1];
    const ownerByStage: Record<string, string> = { brief: "marketing", production: job.type === "Capturing" ? "capturing" : job.type === "Digital Marketing" ? "marketing" : "graphics", review: "management", approved: "finance", invoice: "finance", sent: "marketing", payment: "finance", closed: "management" };
    patchJob(job.id, { stage: next, assignedRole: ownerByStage[next] || "management", paymentStatus: next === "closed" ? "verified" : job.paymentStatus }, `${job.id} moved to ${stageNames[next]}. WhatsApp notification queued.`);
  }

  async function createJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget); const data = Object.fromEntries(form.entries());
    const response = await fetch("/api/jobs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const row = await response.json(); setJobs(list => [...list, row]); setNewOpen(false); setSelected(row); setToast("Job created and Customer Care notified on WhatsApp.");
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
        <div className="brand"><div className="brand-mark"><Zap size={18} fill="currentColor" /></div><div><strong>ISM Flow</strong><span>Marketing operations</span></div></div>
        <button className="close-nav" onClick={() => setMobileNav(false)}><X size={20} /></button>
        <nav>
          <p>Workspace</p>
          <Nav icon={LayoutDashboard} label="Overview" active={view === "overview"} onClick={() => { setView("overview"); setMobileNav(false); }} />
          <Nav icon={BriefcaseBusiness} label="All jobs" count={active.length} active={view === "jobs"} onClick={() => { setView("jobs"); setMobileNav(false); }} />
          <Nav icon={CalendarDays} label="Calendar" active={view === "calendar"} onClick={() => { setView("calendar"); setMobileNav(false); }} />
          {role === "management" && <Nav icon={Users} label="Team & roles" active={view === "team"} onClick={() => { setView("team"); setMobileNav(false); }} />}
          <p>My work</p>
          <Nav icon={Clock3} label="Needs attention" count={pendingMine.length} onClick={() => setView("jobs")} />
          <Nav icon={Check} label="Completed" onClick={() => setView("jobs")} />
        </nav>
        <div className="automation-card"><Sparkles size={18} /><strong>WhatsApp automation</strong><span>Every job hand-off creates an in-app alert and a WhatsApp queue item.</span><div><i /> Ready to connect</div></div>
        <div className="sidebar-user"><div className="avatar">{rolePeople[role][0]}</div><div><strong>{rolePeople[role]}</strong><span>{roleNames[role]}</span></div><MoreHorizontal size={18} /></div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="menu-button" onClick={() => setMobileNav(true)}><Menu size={22} /></button>
          <div className="search"><Search size={17} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search jobs, clients or IDs…" /><kbd>⌘ K</kbd></div>
          <div className="top-actions">
            <div className="role-switch"><span>Viewing as</span><select value={role} onChange={e => setRole(e.target.value)}>{Object.entries(roleNames).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select><ChevronDown size={14} /></div>
            <button className="icon-button"><Bell size={19} /><i /></button>
            <button className="primary-button" onClick={() => setNewOpen(true)}><Plus size={17} /> New job</button>
          </div>
        </header>

        <section className="content">
          {view === "overview" && <Overview jobs={jobs} role={role} active={active.length} mine={pendingMine.length} revenue={revenue} onSelect={setSelected} onCalendar={() => setView("calendar")} />}
          {view === "jobs" && <JobsView jobs={visible} loading={loading} onSelect={setSelected} />}
          {view === "calendar" && <CalendarView jobs={visible} onSelect={setSelected} />}
          {view === "team" && <TeamView />}
        </section>
      </main>

      {selected && <JobDrawer job={selected} role={role} onClose={() => setSelected(null)} onAdvance={() => advance(selected)} onPatch={patchJob} />}
      {newOpen && <NewJob onClose={() => setNewOpen(false)} onSubmit={createJob} />}
      {toast && <div className="toast"><Check size={17} /><span>{toast}</span></div>}
    </div>
  );
}

function Nav({ icon: Icon, label, count, active, onClick }: { icon: typeof LayoutDashboard; label: string; count?: number; active?: boolean; onClick: () => void }) {
  return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}><Icon size={18} /><span>{label}</span>{count !== undefined && <b>{count}</b>}</button>;
}

function Overview({ jobs, role, active, mine, revenue, onSelect, onCalendar }: { jobs: Job[]; role: string; active: number; mine: number; revenue: number; onSelect: (j: Job) => void; onCalendar: () => void }) {
  const today = jobs.filter(j => j.date === "2026-11-08" || j.date === "2026-11-09").slice(0, 4);
  return <>
    <div className="page-heading"><div><p className="eyebrow">SUNDAY, 8 NOVEMBER</p><h1>Good evening, {rolePeople[role]}.</h1><span>Here’s what’s moving across the agency today.</span></div><button className="secondary-button" onClick={onCalendar}><CalendarDays size={17} /> Open calendar</button></div>
    <div className="stats-grid">
      <Stat label="Active jobs" value={String(active)} detail="3 need attention" tone="violet" icon={BriefcaseBusiness} />
      <Stat label="Assigned to you" value={String(mine)} detail={`${roleNames[role]} queue`} tone="blue" icon={Zap} />
      <Stat label="Awaiting approval" value={String(jobs.filter(j => j.stage === "review").length)} detail="Management review" tone="amber" icon={Clock3} />
      <Stat label="Revenue closed" value={money(revenue)} detail="This month" tone="green" icon={CircleDollarSign} />
    </div>
    <div className="dashboard-grid">
      <div className="panel">
        <div className="panel-title"><div><h2>Today & next up</h2><span>Agency schedule</span></div><button onClick={onCalendar}>View calendar <ChevronRight size={15} /></button></div>
        <div className="agenda">{today.map(job => <button className="agenda-row" key={job.id} onClick={() => onSelect(job)}><div className="date-block"><b>{dayLabel(job.date).split(" ")[1]}</b><span>{dayLabel(job.date).split(" ")[0]}</span></div><div className={`agenda-line ${stageColors[job.stage]}`} /><div className="agenda-copy"><span>{job.time} · {job.location}</span><strong>{job.client} — {job.title}</strong><small>{job.type} · {job.owner}</small></div><Stage stage={job.stage} /><ChevronRight size={17} /></button>)}</div>
      </div>
      <div className="panel attention-panel">
        <div className="panel-title"><div><h2>Needs attention</h2><span>Next actions</span></div><b>{jobs.filter(j => j.stage === "review" || j.stage === "invoice" || j.stage === "payment").length}</b></div>
        {jobs.filter(j => ["review", "invoice", "payment"].includes(j.stage)).slice(0, 4).map(job => <button className="attention-row" key={job.id} onClick={() => onSelect(job)}><div className={`mini-icon ${stageColors[job.stage]}`}>{job.stage === "review" ? <Check size={17} /> : <FileText size={17} />}</div><div><strong>{stageNames[job.stage]}</strong><span>{job.client} · {job.id}</span></div><ChevronRight size={16} /></button>)}
      </div>
    </div>
    <div className="panel pipeline-panel"><div className="panel-title"><div><h2>Live job pipeline</h2><span>Click any job to inspect its full history</span></div></div><div className="pipeline">{["visit", "production", "review", "invoice", "closed"].map(stage => <div key={stage} className="pipeline-column"><div><span>{stageNames[stage]}</span><b>{jobs.filter(j => j.stage === stage).length}</b></div>{jobs.filter(j => j.stage === stage).slice(0, 2).map(job => <button key={job.id} onClick={() => onSelect(job)}><small>{job.id} · {job.type}</small><strong>{job.client}</strong><span>{job.title}</span><i>{job.owner}</i></button>)}</div>)}</div></div>
  </>;
}

function Stat({ label, value, detail, tone, icon: Icon }: { label: string; value: string; detail: string; tone: string; icon: typeof Zap }) { return <div className="stat-card"><div className={`stat-icon ${tone}`}><Icon size={19} /></div><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>; }
function Stage({ stage }: { stage: string }) { return <span className={`stage stage-${stageColors[stage]}`}><i />{stageNames[stage] || stage}</span>; }

function JobsView({ jobs, loading, onSelect }: { jobs: Job[]; loading: boolean; onSelect: (j: Job) => void }) {
  return <><div className="page-heading compact"><div><p className="eyebrow">WORKSPACE</p><h1>All jobs</h1><span>Every client request, hand-off and payment in one view.</span></div><button className="secondary-button"><ListFilter size={17} /> Filter</button></div><div className="panel table-panel"><div className="job-table"><div className="job-tr job-th"><span>Job</span><span>Type</span><span>Schedule</span><span>Owner</span><span>Status</span><span>Value</span></div>{loading ? <div className="empty">Loading jobs…</div> : jobs.map(job => <button className="job-tr" key={job.id} onClick={() => onSelect(job)}><span><strong>{job.client}</strong><small>{job.id} · {job.title}</small></span><span>{job.type}</span><span>{dayLabel(job.date)} · {job.time}</span><span><i className="person-dot">{job.owner[0]}</i>{job.owner}</span><span><Stage stage={job.stage} /></span><span>{money(job.price)}<ChevronRight size={16} /></span></button>)}</div></div></>;
}

function CalendarView({ jobs, onSelect }: { jobs: Job[]; onSelect: (j: Job) => void }) {
  const days = [8,9,10,11,12,13,14];
  return <><div className="page-heading compact"><div><p className="eyebrow">CALENDAR</p><h1>Agency schedule</h1><span>Week of 8–14 November 2026</span></div><div className="calendar-controls"><button>Today</button><button>‹</button><button>›</button></div></div><div className="calendar panel"><div className="calendar-time" />{days.map(d => <div className={`calendar-day ${d === 8 ? "today" : ""}`} key={d}><span>{["SUN","MON","TUE","WED","THU","FRI","SAT"][d-8]}</span><b>{d}</b></div>)}{["08:00","10:00","12:00","14:00","16:00","18:00"].map(t => <div className="time-row" key={t}><span>{t}</span><i /></div>)}{jobs.filter(j => Number(j.date.slice(-2)) >= 8 && Number(j.date.slice(-2)) <= 14).map(job => { const day = Number(job.date.slice(-2)) - 8; const hour = Number(job.time.slice(0,2)); return <button key={job.id} className={`calendar-event ${stageColors[job.stage]}`} style={{ left: `calc(64px + ${day} * ((100% - 64px) / 7) + 5px)`, width: "calc((100% - 64px) / 7 - 10px)", top: `${72 + (hour - 8) * 40}px` }} onClick={() => onSelect(job)}><b>{job.time}</b><strong>{job.client}</strong><span>{job.type}</span></button>; })}</div></>;
}

function TeamView() { const members = [["Nadeesha","Management","Admin"],["Dinithi","Marketing & Customer Care","5 active"],["Kavindu","Graphic Designer","2 active"],["Sahan","Capturing Team","2 active"],["Hasini","Finance","2 pending"]]; return <><div className="page-heading compact"><div><p className="eyebrow">ADMIN</p><h1>Team & roles</h1><span>Manage access, departments and workload.</span></div><button className="primary-button"><Plus size={17}/> Add employee</button></div><div className="team-grid">{members.map(([name, dept, state]) => <div className="team-card" key={name}><div className="avatar large">{name[0]}</div><strong>{name}</strong><span>{dept}</span><small>{state}</small><button><Settings size={15}/> Manage access</button></div>)}</div></>; }

function JobDrawer({ job, role, onClose, onAdvance, onPatch }: { job: Job; role: string; onClose: () => void; onAdvance: () => void; onPatch: (id: string, update: Partial<Job>, notice: string) => void }) {
  const progress = Math.max(1, stages.indexOf(job.stage) + 1); const canAdvance = role === "management" || role === job.assignedRole || (job.stage === "sent" && role === "marketing");
  return <div className="overlay" onMouseDown={e => { if (e.currentTarget === e.target) onClose(); }}><aside className="drawer"><div className="drawer-head"><div><span>{job.id}</span><h2>{job.client}</h2><p>{job.title}</p></div><button onClick={onClose}><X size={20}/></button></div><div className="drawer-body"><Stage stage={job.stage}/><section><label>Job progress</label><div className="progress-track">{stages.map((s,i) => <div key={s} className={i < progress ? "done" : ""}><i>{i < progress-1 ? <Check size={10}/> : i+1}</i><span>{stageNames[s].split(" ")[0]}</span></div>)}</div></section><div className="detail-grid"><Detail icon={CalendarDays} label="Schedule" value={`${dayLabel(job.date)} at ${job.time}`} /><Detail icon={MapPin} label="Location" value={job.location} /><Detail icon={Users} label="Owner" value={`${job.owner} · ${roleNames[job.assignedRole] || job.assignedRole}`} /><Detail icon={CircleDollarSign} label="Agreed price" value={money(job.price)} /></div><section><label>Client contact</label><div className="contact-card"><div className="avatar">{job.contactName[0]}</div><div><strong>{job.contactName}</strong><span>{job.contactPhone}</span></div><button><MessageCircleMore size={17}/> WhatsApp</button></div></section><section><label>Brief & visit notes</label><p className="brief">{job.brief}</p></section>{job.filesUrl && <section><label>Production files</label><a className="file-link" href={`https://${job.filesUrl}`} target="_blank"><Link2 size={17}/><div><strong>Open final files</strong><span>{job.filesUrl}</span></div><ChevronRight size={16}/></a></section>}<section><label>Finance</label><div className="finance-line"><span>Invoice</span><strong>{job.invoiceNo || "Not created"}</strong></div><div className="finance-line"><span>Payment</span><strong className={job.paymentStatus === "verified" ? "success" : ""}>{job.paymentStatus}</strong></div>{role === "finance" && !job.invoiceNo && <button className="inline-action" onClick={() => onPatch(job.id, { invoiceNo: `INV-2026-${Math.floor(120+Math.random()*80)}`, stage: "invoice" }, "Invoice created. Management and Customer Care notified.")}><FileText size={16}/> Create invoice</button>}</section><section><label>Notification trail</label><div className="activity"><i/><div><strong>Assigned to {roleNames[job.assignedRole]}</strong><span>In-app + WhatsApp queue · latest update</span></div></div><div className="activity muted"><i/><div><strong>Job created by Management</strong><span>Calendar event and customer record created</span></div></div></section></div><div className="drawer-footer"><button className="secondary-button" onClick={onClose}>Close</button><button className="primary-button" disabled={!canAdvance || job.stage === "closed"} onClick={onAdvance}>{job.stage === "review" ? "Approve work" : job.stage === "payment" ? "Verify & close" : job.stage === "closed" ? "Job completed" : "Complete stage"}<ChevronRight size={16}/></button></div></aside></div>;
}

function Detail({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: string }) { return <div className="detail"><Icon size={17}/><div><span>{label}</span><strong>{value}</strong></div></div>; }

function NewJob({ onClose, onSubmit }: { onClose: () => void; onSubmit: (e: FormEvent<HTMLFormElement>) => void }) { return <div className="overlay"><form className="modal" onSubmit={onSubmit}><div className="modal-head"><div><p className="eyebrow">NEW CLIENT WORK</p><h2>Create a job</h2><span>Add it to the calendar and notify Customer Care.</span></div><button type="button" onClick={onClose}><X size={20}/></button></div><div className="form-grid"><label>Client / company<input required name="client" placeholder="ABC Company" /></label><label>Job title<input required name="title" placeholder="November social campaign" /></label><label>Job type<select name="type"><option>Graphic Design</option><option>Capturing</option><option>Digital Marketing</option><option>Customer Care</option></select></label><label>Agreed price (LKR)<input name="price" type="number" placeholder="85000" /></label><label>Visit date<input required name="date" type="date" defaultValue="2026-11-09" /></label><label>Time<input required name="time" type="time" defaultValue="09:00" /></label><label>Location<input name="location" placeholder="Colombo 03 / Online" /></label><label>Customer Care owner<input name="owner" defaultValue="Dinithi" /></label><label>Client contact<input name="contactName" placeholder="Contact name" /></label><label>WhatsApp number<input name="contactPhone" placeholder="+94 77 123 4567" /></label><label className="full">Brief / visit purpose<textarea name="brief" placeholder="What does the client need? Add initial notes here…" /></label></div><div className="modal-footer"><div><MessageCircleMore size={16}/><span>Customer Care will receive an in-app + WhatsApp notification.</span></div><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button className="primary-button"><Plus size={16}/> Create job</button></div></form></div>; }
