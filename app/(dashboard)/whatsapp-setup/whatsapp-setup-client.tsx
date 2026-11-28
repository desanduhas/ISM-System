"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MetaTemplate {
  id?: string;
  name: string;
  language?: string;
  status?: string;
  category?: string;
  outcome?: "created" | "existing" | "failed";
  error?: string;
}

const STATUS_STYLES: Record<string, string> = {
  APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-800",
  ACTIVE: "border-emerald-200 bg-emerald-50 text-emerald-800",
  PENDING: "border-amber-200 bg-amber-50 text-amber-800",
  REJECTED: "border-red-200 bg-red-50 text-red-800",
  PAUSED: "border-red-200 bg-red-50 text-red-800",
  FAILED: "border-red-200 bg-red-50 text-red-800",
  MISSING: "border-stone-200 bg-stone-100 text-stone-700",
};

export default function WhatsAppSetupClient() {
  const [required, setRequired] = useState<string[]>([]);
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/whatsapp/templates", { cache: "no-store" });
      const data = await response.json() as {
        templates?: MetaTemplate[];
        required?: string[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || "Could not load Meta templates");
      setRequired(data.required || []);
      setTemplates(data.templates || []);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not load Meta templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const rows = useMemo(() => required.map(name => {
    const template = templates.find(item => item.name === name);
    return template || { name, status: "MISSING" };
  }), [required, templates]);

  const approvedCount = rows.filter(row => ["APPROVED", "ACTIVE"].includes(row.status || "")).length;
  const pendingCount = rows.filter(row => row.status === "PENDING").length;

  async function createTemplates() {
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/whatsapp/templates", { method: "POST" });
      const data = await response.json() as { results?: MetaTemplate[]; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not submit templates to Meta");

      const failed = (data.results || []).filter(result => result.outcome === "failed");
      await loadTemplates();
      if (failed.length) {
        setError(failed.map(result => `${result.name}: ${result.error || "Failed"}`).join(" | "));
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not submit templates to Meta");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="operations-module module-whatsapp-setup">
      <header className="module-heading flex items-end justify-between">
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-[0.16em] text-amber-700">Management · Integration</p>
          <h1>WhatsApp setup</h1>
          <p>Submit and monitor the approved Meta templates used by every automated ISM Flow notification.</p>
        </div>
        <Button variant="outline" onClick={() => void loadTemplates()} disabled={loading || creating}>
          <RefreshCw className={loading ? "animate-spin" : ""} size={17} /> Refresh status
        </Button>
      </header>

      <section className="module-metrics" data-count="3" aria-label="WhatsApp template summary">
        <dl className="module-metric">
          <dt>Required <MessageCircle size={17} /></dt>
          <dd><strong>{required.length || 9}</strong><span>Workflow templates</span></dd>
        </dl>
        <dl className="module-metric">
          <dt>Approved <CheckCircle2 size={17} /></dt>
          <dd><strong>{approvedCount}</strong><span>Ready for live messages</span></dd>
        </dl>
        <dl className="module-metric">
          <dt>Pending <Loader2 size={17} /></dt>
          <dd><strong>{pendingCount}</strong><span>Waiting for Meta review</span></dd>
        </dl>
      </section>

      {error && (
        <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900" role="alert">
          <AlertTriangle className="mt-0.5 shrink-0" size={19} />
          <p className="break-words">{error}</p>
        </div>
      )}

      <section className="rounded-md border border-stone-300 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-200 p-5">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-stone-950">Meta template registry</h2>
            <p className="mt-1 text-sm text-stone-600">Existing templates are preserved. Only missing templates are submitted.</p>
          </div>
          <Button onClick={() => void createTemplates()} disabled={creating || loading} className="bg-stone-950 text-white hover:bg-stone-800">
            {creating && <Loader2 className="animate-spin" size={17} />}
            {creating ? "Submitting to Meta" : "Create missing templates"}
          </Button>
        </div>

        <div className="module-table-scroll overflow-x-auto">
          <table className="module-table">
            <thead><tr><th>Template</th><th>Language</th><th>Category</th><th>Status</th></tr></thead>
            <tbody>
              {loading && !rows.length ? (
                <tr><td colSpan={4}>Checking the Meta template registry...</td></tr>
              ) : rows.map(row => {
                const status = row.status || "MISSING";
                return (
                  <tr key={row.name}>
                    <td data-label="Template" className="font-semibold text-stone-950">{row.name}</td>
                    <td data-label="Language">{row.language || "en_US"}</td>
                    <td data-label="Category">{row.category || "UTILITY"}</td>
                    <td data-label="Status">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_STYLES[status] || STATUS_STYLES.MISSING}`}>
                        {status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-sm leading-6 text-stone-600">
        Meta can take several minutes to review new utility templates. Refresh this page until each required template is approved.
      </p>
    </main>
  );
}
