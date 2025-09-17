"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";

export function NotesParseSection({
  engagementId,
  initialNotes,
}: {
  engagementId: string;
  initialNotes: string | null | undefined;
}) {
  const [notes, setNotes] = useState<string>(initialNotes || "");
  const [saving, setSaving] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Single full report (ISP) preview and editable draft
  const [isp, setIsp] = useState<string>("");
  const [ispDraft, setIspDraft] = useState<string>("");
  const [ispDirty, setIspDirty] = useState(false);
  const [editing, setEditing] = useState(false);
  const ctrl = useRef<AbortController | null>(null);

  const canParse = useMemo(() => !!notes && !parsing, [notes, parsing]);

  // Load any existing saved report on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch(`/api/engagements/${engagementId}`);
        if (!res.ok) return;
        const data = (await res.json()) as { engagement?: { isp_md?: string | null } };
        const existing = data?.engagement?.isp_md || "";
        if (mounted && existing) {
          setIsp(existing);
          setIspDraft(existing);
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [engagementId]);

  async function onSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/engagements/${engagementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to save notes");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save notes");
    } finally {
      setSaving(false);
    }
  }

  async function onParse() {
    setError(null);
    setParsing(true);
    setIsp("");
    if (!ispDirty) setIspDraft("");

    ctrl.current = new AbortController();

    try {
      const res = await fetch(`/api/engagements/${engagementId}/notes/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
        signal: ctrl.current.signal,
      });

      if (!res.ok) {
        if (res.status === 429) {
          const msg = await res.text();
          setError(msg || "Rate limit exceeded. Try again shortly.");
        } else if (res.status === 401) {
          setError("Please sign in.");
        } else {
          const msg = await res.text();
          setError(msg || `Request failed: ${res.status}`);
        }
        setParsing(false);
        return;
      }

      if (!res.body) {
        setError("No response stream.");
        setParsing(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const lines = rawEvent.split("\n");
          const eventLine = lines.find((l) => l.startsWith("event:"));
          const dataLine = lines.find((l) => l.startsWith("data:"));
          if (!dataLine) continue;

          const eventName = eventLine ? eventLine.replace(/^event:\s?/, "").trim() : "message";
          try {
            const data = JSON.parse(dataLine.replace(/^data:\s?/, ""));
            if (eventName === "isp_chunk") {
              if (data?.text) setIsp((prev) => (prev ? prev + "\n" : "") + String(data.text));
              if (data?.text && !ispDirty) {
                setIspDraft((prev) => (prev ? prev + "\n" : "") + String(data.text));
              }
            } else if (eventName === "error") {
              setError(String(data?.message || data?.error || "Unknown error"));
            } else if (eventName === "done") {
              if (ctrl.current) ctrl.current.abort();
            }
          } catch {
            // ignore bad JSON
          }
        }
      }
    } catch (e) {
      if ((e as { name?: string })?.name !== "AbortError") {
        setError(e instanceof Error ? e.message : "Stream error");
      }
    } finally {
      setParsing(false);
    }
  }

  function onCancel() {
    if (ctrl.current) {
      ctrl.current.abort();
      ctrl.current = null;
    }
    setParsing(false);
  }

  async function onSaveReport() {
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/engagements/${engagementId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isp_md: ispDraft || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to save report");
      }
      setIspDirty(false);
      setIsp(ispDraft);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save report");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-md font-semibold mb-2">Meeting Notes</h3>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Dump meeting prep/notes here..."
          className="w-full border rounded px-2 py-1"
          rows={6}
        />
        {error && <div className="text-sm text-red-600 mt-1">{error}</div>}
        <div className="flex gap-2 mt-2">
          <button onClick={onSave} disabled={saving} className="bg-muted text-foreground px-3 py-1.5 rounded border">
            {saving ? "Saving..." : "Save Notes"}
          </button>
          <button onClick={onParse} disabled={!canParse} className="bg-primary text-white px-3 py-1.5 rounded">
            {parsing ? "Parsing..." : "Parse Notes"}
          </button>
          {parsing && (
            <button type="button" onClick={onCancel} className="bg-muted text-foreground px-3 py-1.5 rounded">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Engagement Report (ISP) */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <div className="text-sm font-medium">Engagement Report (Markdown)</div>
          {!editing ? (
            <button
              type="button"
              className="text-xs border rounded px-2 py-1"
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                className="text-xs border rounded px-2 py-1"
                onClick={() => {
                  setEditing(false);
                  setIspDraft(isp); // revert edits
                  setIspDirty(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="text-xs border rounded px-2 py-1 bg-primary text-white"
                onClick={onSaveReport}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Report"}
              </button>
            </div>
          )}
        </div>
        {!editing ? (
          <pre className="text-xs whitespace-pre-wrap border rounded p-2 min-h-[6rem]">{isp || "—"}</pre>
        ) : (
          <textarea
            value={ispDraft}
            onChange={(e) => {
              setIspDraft(e.target.value);
              setIspDirty(true);
            }}
            rows={16}
            className="w-full border rounded px-2 py-1 text-sm font-mono"
            placeholder="Full Engagement Report in Markdown"
          />
        )}
      </div>
    </div>
  );
}
