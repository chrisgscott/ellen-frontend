"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";

export function CreateEngagementForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const title = String(form.get("title") || "Untitled Engagement");
    const topic = form.get("topic") ? String(form.get("topic")) : null;
    const meeting_datetime = form.get("meeting_datetime") ? new Date(String(form.get("meeting_datetime"))).toISOString() : null;
    const location = form.get("location") ? String(form.get("location")) : null;
    const duration_minutes = form.get("duration_minutes") ? Number(form.get("duration_minutes")) : null;
    const org_counterparty = form.get("org_counterparty") ? String(form.get("org_counterparty")) : null;
    const objectivesRaw = form.get("objectives") ? String(form.get("objectives")) : "";
    const objectives = objectivesRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const notes = form.get("notes") ? String(form.get("notes")) : null;

    const res = await fetch("/api/engagements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        topic,
        meeting_datetime,
        location,
        duration_minutes,
        org_counterparty,
        objectives: objectives.length ? objectives : null,
        notes,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || "Failed to create engagement");
      setLoading(false);
      return;
    }
    const engagementId = data?.engagement?.id;
    if (engagementId) {
      // Fire webhook on initial submission BEFORE report generation
      try {
        const payload = {
          engagementId,
          title,
          topic,
          meeting_datetime,
          duration_minutes,
          location,
          org_counterparty,
          objectives,
          notes,
          participants: [],
          original: {
            title,
            topic,
            meeting_datetime,
            duration_minutes,
            location,
            org_counterparty,
            objectives,
            notes,
          },
          meta: {
            sentAt: new Date().toISOString(),
            source: "ellen-dashboard/create-engagement-form",
            trigger: "create",
          },
        };
        const hookRes = await fetch(
          "https://n8n-od58.onrender.com/webhook-test/cfeaddc6-77d3-4c34-8bf5-32d8900ebb7b",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        );
        if (!hookRes.ok) {
          // Non-blocking: log to console and continue
          console.warn("[create-form] webhook non-OK:", hookRes.status);
        }
      } catch (err) {
        // Non-blocking
        console.warn("[create-form] webhook error:", err);
      }

      // Trigger report generation and wait for completion before redirecting
      try {
        const reportRes = await fetch(`/api/engagements/${engagementId}/report`, { method: "POST" });
        if (!reportRes.ok) {
          const r: unknown = await reportRes.json().catch(() => ({}));
          const errMsg = typeof r === "object" && r && "error" in r ? String((r as { error?: unknown }).error) : undefined;
          setError(errMsg || `Failed to generate report (${reportRes.status})`);
          setLoading(false);
          return;
        }
      } catch {
        setError("Failed to generate report");
        setLoading(false);
        return;
      }
      setLoading(false);
      router.push(`/home/engagements/${engagementId}`);
    } else {
      setLoading(false);
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div>
        <label className="block text-sm font-medium">Title</label>
        <input name="title" className="w-full border rounded px-2 py-1" placeholder="Quarterly planning with ACME" required />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium">Topic</label>
          <input name="topic" className="w-full border rounded px-2 py-1" placeholder="Supply agreement, cathode materials" />
        </div>
        <div>
          <label className="block text-sm font-medium">Counterparty Org</label>
          <input name="org_counterparty" className="w-full border rounded px-2 py-1" placeholder="ACME Corp" />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium">Date/Time</label>
          <input type="datetime-local" name="meeting_datetime" className="w-full border rounded px-2 py-1" />
        </div>
        <div>
          <label className="block text-sm font-medium">Duration (min)</label>
          <input type="number" name="duration_minutes" className="w-full border rounded px-2 py-1" min={0} />
        </div>
        <div>
          <label className="block text-sm font-medium">Location</label>
          <input name="location" className="w-full border rounded px-2 py-1" placeholder="Remote / HQ / Client site" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium">Objectives (comma separated)</label>
        <input name="objectives" className="w-full border rounded px-2 py-1" placeholder="Align scope, Confirm owners, Decide timeline" />
      </div>
      <div>
        <label className="block text-sm font-medium">Notes</label>
        <textarea name="notes" className="w-full border rounded px-2 py-1" rows={3} />
      </div>
      <button type="submit" disabled={loading} className="bg-primary text-white px-3 py-1.5 rounded">
        {loading ? "Creating & Generating report..." : "Create Engagement"}
      </button>
    </form>
  );
}
