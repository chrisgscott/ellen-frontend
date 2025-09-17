"use client";
import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "@/hooks/use-toast";
import { MeetingIntelligenceReport } from "@/lib/types/meeting-report";
import { ReportView } from "@/components/engagements/ReportView";
import { Calendar, MapPin, Users, Target, ListChecks, AlertTriangle, Clock } from "lucide-react";

const isDev = process.env.NODE_ENV !== "production";

export type Participant = {
  id?: string;
  name: string;
  role_title?: string | null;
  organization?: string | null;
  is_internal?: boolean | null;
  created_at?: string;
};

export type Engagement = {
  id: string;
  title: string;
  topic?: string | null;
  meeting_datetime?: string | null;
  duration_minutes?: number | null;
  location?: string | null;
  org_counterparty?: string | null;
  objectives?: string[] | null;
  notes?: string | null;
  isp_md?: string | null;
  // Prefer JSON for rendering if available
  isp_json?: unknown | null;
};

export function EngagementDetailEditor({
  engagement,
  participants: initialParticipants,
}: {
  engagement: Engagement;
  participants: Participant[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const [title, setTitle] = useState(engagement.title || "");
  const [topic, setTopic] = useState(engagement.topic || "");
  const [meetingDatetime, setMeetingDatetime] = useState<string>(
    engagement.meeting_datetime ? new Date(engagement.meeting_datetime).toISOString().slice(0, 16) : ""
  );
  const [duration, setDuration] = useState<string>(
    typeof engagement.duration_minutes === "number" ? String(engagement.duration_minutes) : ""
  );
  const [location, setLocation] = useState(engagement.location || "");
  const [counterparty, setCounterparty] = useState(engagement.org_counterparty || "");
  const [objectives, setObjectives] = useState<string>((engagement.objectives || []).join(", "));
  const [notes, setNotes] = useState(engagement.notes || "");
  const [report, setReport] = useState(engagement.isp_md || "");
  const [reportJson, setReportJson] = useState<MeetingIntelligenceReport | null>(() => {
    const j = engagement.isp_json as unknown;
    if (!j) return null;
    try {
      // it may already be an object or a serialized string
      const obj = typeof j === "string" ? JSON.parse(j) : j;
      // minimally sanity check expected keys
      if (obj && typeof obj === "object" && Array.isArray(obj.meetingOverview)) {
        return obj as MeetingIntelligenceReport;
      }
      return null;
    } catch {
      return null;
    }
  });

  const [participants, setParticipants] = useState<Participant[]>(initialParticipants || []);

  const canSave = useMemo(() => !saving, [saving]);

  const [regenLoading, setRegenLoading] = useState(false);
  const [regenProgress, setRegenProgress] = useState<string[]>([]);
  const [webhookSending, setWebhookSending] = useState(false);

  async function saveEngagement() {
    const payload: Record<string, unknown> = {
      title: title || null,
      topic: topic || null,
      meeting_datetime: meetingDatetime ? new Date(meetingDatetime).toISOString() : null,
      duration_minutes: duration ? Number(duration) : null,
      location: location || null,
      org_counterparty: counterparty || null,
      objectives: objectives
        ? objectives
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
      notes: notes || null,
      isp_md: report || null,
    };
    const res = await fetch(`/api/engagements/${engagement.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || "Failed to save engagement");
    }
  }

  function buildWebhookPayload(trigger: "manual" | "save") {
    const normalizedObjectives = objectives
      ? objectives
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    return {
      engagementId: engagement.id,
      // current form state (edited values)
      title: title || null,
      topic: topic || null,
      meeting_datetime: meetingDatetime ? new Date(meetingDatetime).toISOString() : null,
      duration_minutes: duration ? Number(duration) : null,
      location: location || null,
      org_counterparty: counterparty || null,
      objectives: normalizedObjectives,
      notes: notes || null,
      report_markdown: report || null,
      report_json: reportJson || null,
      participants: (participants || []).map((p) => ({
        id: p.id || null,
        name: p.name,
        role_title: p.role_title ?? null,
        organization: p.organization ?? null,
        is_internal: !!p.is_internal,
      })),
      // include original server values for reference
      original: {
        title: engagement.title ?? null,
        topic: engagement.topic ?? null,
        meeting_datetime: engagement.meeting_datetime ?? null,
        duration_minutes: engagement.duration_minutes ?? null,
        location: engagement.location ?? null,
        org_counterparty: engagement.org_counterparty ?? null,
        objectives: engagement.objectives ?? [],
        notes: engagement.notes ?? null,
        isp_md: engagement.isp_md ?? null,
      },
      meta: {
        sentAt: new Date().toISOString(),
        source: "ellen-dashboard/engagement-detail-editor",
        trigger,
      },
    };
  }

  async function sendToWebhook() {
    setError(null);
    setWebhookSending(true);
    try {
      const payload = buildWebhookPayload("manual");

      const res = await fetch(
        "https://n8n-od58.onrender.com/webhook-test/cfeaddc6-77d3-4c34-8bf5-32d8900ebb7b",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Webhook responded with ${res.status}`);
      }
      toast({ title: "Webhook sent", description: "Engagement data posted successfully." });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to send webhook";
      setError(msg);
      toast({ title: "Webhook failed", description: msg, variant: "destructive" });
    } finally {
      setWebhookSending(false);
    }
  }

  async function regenerateReport() {
    setError(null);
    setRegenLoading(true);
    setRegenProgress([]);
    try {
      if (isDev) console.log("[regen] POST /report starting");
      const res = await fetch(`/api/engagements/${engagement.id}/report`, { method: "POST" });
      type ReportPostResp = { ok?: boolean; isp_md?: string; report?: MeetingIntelligenceReport; error?: string };
      const raw: ReportPostResp = await res.json().catch(() => ({} as ReportPostResp));
      const ok = Boolean(raw.ok);
      const isp_md_resp = typeof raw.isp_md === "string" ? raw.isp_md : "";
      const errMsg = typeof raw.error === "string" ? raw.error : undefined;
      if (!res.ok || !ok) {
        throw new Error(errMsg ?? "Failed to regenerate report");
      }
      const newMd = isp_md_resp;
      setReport(newMd.trim());
      if (raw.report && typeof raw.report === "object") {
        setReportJson(raw.report);
      }
      setRegenLoading(false);
      setRegenProgress([]);
      toast({
        title: "Report updated",
        description: "The engagement report was regenerated.",
      });
      if (isDev) console.log("[regen] POST /report done, chars=", newMd.length);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to regenerate report";
      if (isDev) console.error("[regen] error", msg);
      setError(msg);
      setRegenLoading(false);
      setRegenProgress([]);
      toast({
        title: "Regeneration failed",
        description: msg,
        variant: "destructive",
      });
    }
  }

  async function saveParticipants() {
    // Diff participants by id. Update existing, create new, delete removed.
    const originalById = new Map((initialParticipants || []).filter(p => p.id).map((p) => [p.id as string, p]));
    const currentById = new Map((participants || []).filter(p => p.id).map((p) => [p.id as string, p]));

    // Deleted
    for (const [pid] of originalById) {
      if (!currentById.has(pid)) {
        const res = await fetch(`/api/engagements/${engagement.id}/participants/${pid}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to delete participant");
      }
    }

    // Upsert existing
    for (const [pid, cur] of currentById) {
      const res = await fetch(`/api/engagements/${engagement.id}/participants/${pid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cur.name,
          role_title: cur.role_title ?? null,
          organization: cur.organization ?? null,
          is_internal: !!cur.is_internal,
        }),
      });
      if (!res.ok) throw new Error("Failed to update participant");
    }

    // Creates
    for (const p of participants) {
      if (!p.id) {
        const res = await fetch(`/api/engagements/${engagement.id}/participants`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: p.name,
            role_title: p.role_title ?? null,
            organization: p.organization ?? null,
            is_internal: !!p.is_internal,
          }),
        });
        if (!res.ok) throw new Error("Failed to create participant");
      }
    }
  }

  async function onSaveAll() {
    setError(null);
    setSaving(true);
    try {
      await saveEngagement();
      await saveParticipants();
      // Post to webhook on initial form submission/save (before any report regeneration)
      try {
        const payload = buildWebhookPayload("save");
        const res = await fetch(
          "https://n8n-od58.onrender.com/webhook-test/cfeaddc6-77d3-4c34-8bf5-32d8900ebb7b",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Webhook responded with ${res.status}`);
        }
        toast({ title: "Webhook sent", description: "Engagement submitted to workflow." });
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to send webhook on save";
        // Don't fail the save because of webhook issues; surface a toast instead.
        toast({ title: "Webhook warning", description: msg, variant: "destructive" });
      }
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  function addParticipant() {
    setParticipants((prev) => [
      ...prev,
      { name: "", role_title: "", organization: "", is_internal: false },
    ]);
  }
  function removeParticipant(idx: number) {
    setParticipants((prev) => prev.filter((_, i) => i !== idx));
  }
  function updateParticipant(idx: number, patch: Partial<Participant>) {
    setParticipants((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  // Narrowed view of the report for sidebar lists
  type SidebarReport = {
    actionItems?: Array<string | { text?: string }>;
    risks?: Array<string | { text?: string }>;
  } | null;
  const sidebarReport: SidebarReport = useMemo(() => {
    if (!reportJson) return null;
    try {
      return reportJson as unknown as SidebarReport;
    } catch {
      return null;
    }
  }, [reportJson]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 print:gap-0 print:items-start">
        <div className="min-w-0 flex-1">
          {!editing ? (
            <h1 className="text-2xl font-semibold leading-tight">{engagement.title}</h1>
          ) : (
            <input
              className="border rounded px-2 py-1 text-lg font-semibold w-full"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
            />
          )}
          {/* At-a-glance meta */}
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {/* Counterparty */}
            <div className="flex items-center gap-2 rounded-md border bg-white/50 px-3 py-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Counterparty</div>
                {!editing ? (
                  <div className="truncate">{counterparty || engagement.org_counterparty || "—"}</div>
                ) : (
                  <input
                    className="w-full border rounded px-2 py-1 text-sm"
                    value={counterparty}
                    onChange={(e) => setCounterparty(e.target.value)}
                    placeholder="Org / Counterparty"
                  />
                )}
              </div>
            </div>
            {/* When */}
            <div className="flex items-center gap-2 rounded-md border bg-white/50 px-3 py-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">When</div>
                {!editing ? (
                  <div className="truncate">{engagement.meeting_datetime ? new Date(engagement.meeting_datetime).toLocaleString() : "TBD"}</div>
                ) : (
                  <input
                    type="datetime-local"
                    className="w-full border rounded px-2 py-1 text-sm"
                    value={meetingDatetime}
                    onChange={(e) => setMeetingDatetime(e.target.value)}
                  />
                )}
              </div>
            </div>
            {/* Location */}
            <div className="flex items-center gap-2 rounded-md border bg-white/50 px-3 py-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Location</div>
                {!editing ? (
                  <div className="truncate">{location || engagement.location || "—"}</div>
                ) : (
                  <input
                    className="w-full border rounded px-2 py-1 text-sm"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Location"
                  />
                )}
              </div>
            </div>
            {/* Duration */}
            <div className="flex items-center gap-2 rounded-md border bg-white/50 px-3 py-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Duration</div>
                {!editing ? (
                  <div className="truncate">{typeof engagement.duration_minutes === "number" ? `${engagement.duration_minutes} min` : duration ? `${duration} min` : "—"}</div>
                ) : (
                  <input
                    type="number"
                    min={0}
                    className="w-full border rounded px-2 py-1 text-sm"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    placeholder="Minutes"
                  />
                )}
              </div>
            </div>
            {/* Topic */}
            <div className="flex items-center gap-2 rounded-md border bg-white/50 px-3 py-2 text-sm">
              <Target className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Topic</div>
                {!editing ? (
                  <div className="truncate">{topic || engagement.topic || "—"}</div>
                ) : (
                  <input
                    className="w-full border rounded px-2 py-1 text-sm"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Topic"
                  />
                )}
              </div>
            </div>
            {/* Participants count */}
            <div className="flex items-center gap-2 rounded-md border bg-white/50 px-3 py-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0">
                <div className="text-xs text-muted-foreground">Participants</div>
                <div className="truncate">{(participants ?? []).length} total</div>
              </div>
            </div>
          </div>
        </div>
        {/* Actions */}
        <div className="shrink-0 space-x-2 print:hidden">
          {!editing ? (
            <>
              <Link
                href={`/home/engagements/${engagement.id}/print`}
                className="text-sm border rounded px-3 py-1"
                target="_blank"
              >
                Print / Export
              </Link>
              <button
                type="button"
                className="text-sm border rounded px-3 py-1"
                onClick={sendToWebhook}
                disabled={webhookSending}
                title="Send current form data to webhook"
              >
                {webhookSending ? "Sending..." : "Send Webhook"}
              </button>
              <button className="text-sm border rounded px-3 py-1" onClick={() => setEditing(true)}>
                Edit
              </button>
            </>
          ) : (
            <>
              <button
                className="text-sm border rounded px-3 py-1"
                onClick={() => {
                  setEditing(false);
                  // revert state
                  setTitle(engagement.title || "");
                  setTopic(engagement.topic || "");
                  setMeetingDatetime(
                    engagement.meeting_datetime ? new Date(engagement.meeting_datetime).toISOString().slice(0, 16) : ""
                  );
                  setDuration(typeof engagement.duration_minutes === "number" ? String(engagement.duration_minutes) : "");
                  setLocation(engagement.location || "");
                  setCounterparty(engagement.org_counterparty || "");
                  setObjectives((engagement.objectives || []).join(", "));
                  setNotes(engagement.notes || "");
                  setReport(engagement.isp_md || "");
                  try {
                    const j = engagement.isp_json as unknown;
                    const obj = typeof j === "string" ? JSON.parse(j) : j;
                    setReportJson(obj && typeof obj === "object" && Array.isArray(obj.meetingOverview) ? (obj as MeetingIntelligenceReport) : null);
                  } catch {
                    setReportJson(null);
                  }
                  setParticipants(initialParticipants || []);
                }}
              >
                Cancel
              </button>
              <button
                className="text-sm border rounded px-3 py-1 bg-primary text-white"
                disabled={!canSave}
                onClick={onSaveAll}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:[grid-template-columns:minmax(0,1fr)_20rem] gap-6 print:grid-cols-1">
        {/* Main content */}
        <div className="min-w-0 print:order-2">
          {/* Notes */}
          <section className="space-y-2">
            <h2 className="text-lg font-semibold">Notes</h2>
            {!editing ? (
              <div className="text-sm whitespace-pre-wrap">{notes || "—"}</div>
            ) : (
              <textarea className="w-full border rounded px-2 py-1 text-sm" rows={6} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Meeting notes" />
            )}
          </section>

          {/* Report */}
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">Engagement Report</h2>
              {!editing && (
                <button
                  type="button"
                  className="text-xs border rounded px-2 py-1 print:hidden"
                  onClick={regenerateReport}
                  disabled={regenLoading}
                >
                  {regenLoading ? "Regenerating..." : "Regenerate Report"}
                </button>
              )}
            </div>
            {!editing && regenProgress.length > 0 && (
              <ul className="text-xs text-muted-foreground space-y-1">
                {regenProgress.map((m, i) => (
                  <li key={i}>• {m}</li>
                ))}
              </ul>
            )}
            {!editing ? (
              reportJson ? (
                <ReportView report={reportJson} />
              ) : (
                <article className="prose dark:prose-invert max-w-none overflow-x-auto prose-ul:my-1 prose-ol:my-1 prose-li:my-0">
                  {report ? (
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        ul: (props) => <ul className="list-disc pl-5 space-y-1" {...props} />,
                        ol: (props) => <ol className="list-decimal pl-5 space-y-1" {...props} />,
                        li: (props) => <li className="leading-relaxed" {...props} />,
                      }}
                    >
                      {report}
                    </ReactMarkdown>
                  ) : (
                    <div className="text-sm text-muted-foreground">—</div>
                  )}
                </article>
              )
            ) : (
              <textarea className="w-full border rounded px-2 py-1 text-sm font-mono" rows={14} value={report} onChange={(e) => setReport(e.target.value)} placeholder="Engagement Report (Markdown)" />
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="md:col-span-1 space-y-4 print:order-1">
          {/* When / Where / Duration */}
          <section className="space-y-2">
            <h2 className="text-base font-semibold">Overview</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-start gap-2"><Calendar className="h-4 w-4 mt-0.5 text-muted-foreground" /><div>
                <div className="font-medium">When</div>
                <div>{engagement.meeting_datetime ? new Date(engagement.meeting_datetime).toLocaleString() : "TBD"}</div>
              </div></div>
              <div className="flex items-start gap-2"><MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" /><div>
                <div className="font-medium">Location</div>
                <div>{engagement.location ?? "—"}</div>
              </div></div>
              <div className="flex items-start gap-2"><Clock className="h-4 w-4 mt-0.5 text-muted-foreground" /><div>
                <div className="font-medium">Duration</div>
                <div>{typeof engagement.duration_minutes === "number" ? `${engagement.duration_minutes} min` : "—"}</div>
              </div></div>
              <div className="flex items-start gap-2"><Target className="h-4 w-4 mt-0.5 text-muted-foreground" /><div>
                <div className="font-medium">Topic</div>
                <div>{engagement.topic ?? "—"}</div>
              </div></div>
            </div>
          </section>

          {/* Objectives */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Objectives</h2>
            </div>
            {!editing ? (
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {(Array.isArray(engagement.objectives) ? engagement.objectives : [])
                  .slice(0, 5)
                  .map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                {(!engagement.objectives || engagement.objectives.length === 0) && <li className="text-muted-foreground">—</li>}
              </ul>
            ) : (
              <input className="w-full border rounded px-2 py-1 text-sm" value={objectives} onChange={(e) => setObjectives(e.target.value)} placeholder="Objectives (comma-separated)" />
            )}
          </section>

          {/* Participants snapshot */}
          <section className="space-y-2">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base font-semibold">Participants</h2>
            </div>
            {!editing ? (
              <div className="space-y-1 text-sm">
                <div className="text-muted-foreground">{(participants ?? []).length} participant(s)</div>
                {(participants ?? []).slice(0, 5).map((p, idx) => (
                  <div key={p.id || `new-${idx}`} className="truncate">
                    <span className="font-medium">{p.name}</span>
                    {p.role_title ? ` — ${p.role_title}` : ""}
                    {p.organization ? ` @ ${p.organization}` : ""}
                    {p.is_internal ? " (internal)" : ""}
                  </div>
                ))}
                {(participants ?? []).length > 5 && (
                  <div className="text-xs text-muted-foreground">+{(participants!.length - 5)} more</div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {(participants ?? []).map((p, idx) => (
                  <div key={p.id || `edit-${idx}`} className="grid grid-cols-1 md:grid-cols-4 gap-2 items-center">
                    <input className="border rounded px-2 py-1 text-sm" value={p.name} onChange={(e) => updateParticipant(idx, { name: e.target.value })} placeholder="Name" />
                    <input className="border rounded px-2 py-1 text-sm" value={p.role_title ?? ""} onChange={(e) => updateParticipant(idx, { role_title: e.target.value })} placeholder="Role/Title" />
                    <input className="border rounded px-2 py-1 text-sm" value={p.organization ?? ""} onChange={(e) => updateParticipant(idx, { organization: e.target.value })} placeholder="Organization" />
                    <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={!!p.is_internal} onChange={(e) => updateParticipant(idx, { is_internal: e.target.checked })} /> Internal</label>
                    <div className="md:col-span-4">
                      <button className="text-xs border rounded px-2 py-1" type="button" onClick={() => removeParticipant(idx)}>Remove</button>
                    </div>
                  </div>
                ))}
                <button className="text-xs border rounded px-2 py-1" type="button" onClick={addParticipant}>Add participant</button>
              </div>
            )}
          </section>

          {/* Actions & Risks from JSON if available (compact) */}
          {sidebarReport && Array.isArray(sidebarReport.actionItems) && (
            <section className="space-y-2">
              <div className="flex items-center gap-2"><ListChecks className="h-4 w-4 text-muted-foreground" /><h2 className="text-base font-semibold">Next Actions</h2></div>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {sidebarReport.actionItems!.slice(0,5).map((a, i) => (
                  <li key={i}>{typeof a === 'string' ? a : (a?.text ?? '')}</li>
                ))}
              </ul>
            </section>
          )}
          {sidebarReport && Array.isArray(sidebarReport.risks) && (
            <section className="space-y-2">
              <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-muted-foreground" /><h2 className="text-base font-semibold">Risks</h2></div>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                {sidebarReport.risks!.slice(0,3).map((r, i) => (
                  <li key={i}>{typeof r === 'string' ? r : (r?.text ?? '')}</li>
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}
    </div>
  );
}
