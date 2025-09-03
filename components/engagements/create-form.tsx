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
    setLoading(false);
    if (!res.ok) {
      setError(data?.error || "Failed to create engagement");
      return;
    }
    const engagementId = data?.engagement?.id;
    if (engagementId) {
      router.push(`/home/engagements/${engagementId}`);
    } else {
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
        {loading ? "Creating..." : "Create Engagement"}
      </button>
    </form>
  );
}
