"use client";

import React from "react";

export default function EngagementsTestPage() {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const [loading, setLoading] = React.useState(false);
  const [log, setLog] = React.useState<string>("");
  const [engagements, setEngagements] = React.useState<any[]>([]);
  const [engagementId, setEngagementId] = React.useState<string>("");

  const appendLog = (msg: string) => setLog((prev) => prev + (prev ? "\n" : "") + msg);

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(`${base}/api/engagements`, { cache: "no-store" });
        if (!res.ok) {
          appendLog(`GET /api/engagements -> ${res.status}`);
          return;
        }
        const data = await res.json();
        const list = data?.engagements ?? [];
        if (!active) return;
        setEngagements(list);
        if (list[0]?.id) setEngagementId(list[0].id);
        appendLog(`Loaded ${list.length} engagements`);
      } catch (e: any) {
        appendLog(`Error loading engagements: ${e?.message || e}`);
      }
    })();
    return () => {
      active = false;
    };
  }, [base]);

  async function runSupportPackage() {
    if (!engagementId) {
      appendLog("No ENGAGEMENT_ID selected");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${base}/api/engagements/${engagementId}/support-package`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_notes: "Test page run" }),
      });
      const json = await res.json().catch(() => ({}));
      appendLog(`POST support-package -> ${res.status}`);
      appendLog(JSON.stringify(json, null, 2));
    } catch (e: any) {
      appendLog(`Error: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  async function runExportDocx() {
    if (!engagementId) {
      appendLog("No ENGAGEMENT_ID selected");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${base}/api/engagements/${engagementId}/export?format=docx`, {
        method: "POST",
      });
      appendLog(`POST export(docx) -> ${res.status} (${res.headers.get("content-type")})`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `engagement-export-${engagementId.slice(0, 8)}.docx`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
      } else {
        const txt = await res.text();
        appendLog(txt);
      }
    } catch (e: any) {
      appendLog(`Error: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  async function listParticipants() {
    if (!engagementId) {
      appendLog("No ENGAGEMENT_ID selected");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${base}/api/engagements/${engagementId}/participants`, { cache: "no-store" });
      appendLog(`GET participants -> ${res.status}`);
      const json = await res.json().catch(() => ({}));
      appendLog(JSON.stringify(json, null, 2));
    } catch (e: any) {
      appendLog(`Error: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  async function patchFirstParticipant() {
    if (!engagementId) {
      appendLog("No ENGAGEMENT_ID selected");
      return;
    }
    setLoading(true);
    try {
      const listRes = await fetch(`${base}/api/engagements/${engagementId}/participants`, { cache: "no-store" });
      const listJson = await listRes.json();
      const first = listJson?.participants?.[0];
      if (!first?.id) {
        appendLog("No participants to patch");
        return;
      }
      const res = await fetch(`${base}/api/engagements/${engagementId}/participants/${first.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role_title: "Director, Operations", is_internal: true }),
      });
      const json = await res.json().catch(() => ({}));
      appendLog(`PATCH participant -> ${res.status}`);
      appendLog(JSON.stringify(json, null, 2));
    } catch (e: any) {
      appendLog(`Error: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h1>Engagements Test</h1>
      <p>This temporary page runs authorized API calls from your current session.</p>

      <div style={{ margin: "16px 0" }}>
        <label>
          Engagement:
          <select
            value={engagementId}
            onChange={(e) => setEngagementId(e.target.value)}
            style={{ marginLeft: 8 }}
          >
            {engagements.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title || e.id}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={runSupportPackage} disabled={loading || !engagementId}>
          Create Support Package
        </button>
        <button onClick={runExportDocx} disabled={loading || !engagementId}>
          Export DOCX
        </button>
        <button onClick={listParticipants} disabled={loading || !engagementId}>
          List Participants
        </button>
        <button onClick={patchFirstParticipant} disabled={loading || !engagementId}>
          Patch First Participant
        </button>
      </div>

      <pre style={{ marginTop: 16, background: "#111", color: "#0f0", padding: 12, whiteSpace: "pre-wrap" }}>
        {log || "(log empty)"}
      </pre>
      <p style={{ marginTop: 8, opacity: 0.7 }}>Note: remove this page after testing.</p>
    </div>
  );
}
