"use client";
import React, { useMemo, useRef, useState } from "react";

type Suggestion = {
  text: string;
  sources?: string[];
};

type ContextEvent = { type: "context"; data: { sources: string[] } };
type SuggestionEvent = { type: "suggestion"; data: { text: string; sources?: string[] } };
type DoneEvent = { type: "done" };
type ErrorEvent = { type: "error"; data?: string };
type EventPayload = ContextEvent | SuggestionEvent | DoneEvent | ErrorEvent;

export function WinGenerateSection({ engagementId }: { engagementId: string }) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const ctrl = useRef<AbortController | null>(null);

  const canStart = useMemo(() => !running, [running]);

  async function startGeneration(form: HTMLFormElement) {
    setError(null);
    setContext([]);
    setSuggestions([]);
    setRunning(true);

    const formData = new FormData(form);
    const body = {
      context_hint: String(formData.get("context_hint") || ""),
      tone: (formData.get("tone") as string) || undefined,
      count: formData.get("count") ? Number(formData.get("count")) : undefined,
    };

    ctrl.current = new AbortController();

    try {
      const res = await fetch(`/api/engagements/${engagementId}/win-statements/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
        setRunning(false);
        return;
      }

      if (!res.body) {
        setError("No response stream.");
        setRunning(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // Parse SSE events
        let idx;
        while ((idx = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const lines = rawEvent.split("\n");
          const dataLine = lines.find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          try {
            const payload: EventPayload = JSON.parse(dataLine.replace(/^data:\s?/, ""));
            if (payload.type === "context") {
              const sources: string[] = Array.isArray(payload.data?.sources)
                ? payload.data.sources
                : [];
              setContext((prev) => [...prev, ...sources]);
            } else if (payload.type === "suggestion") {
              const text: string = payload.data?.text || "";
              const sources: string[] = Array.isArray(payload.data?.sources)
                ? payload.data.sources
                : [];
              setSuggestions((prev) => [...prev, { text, sources }]);
            } else if (payload.type === "error") {
              setError(String(payload.data ?? "Unknown error"));
            } else if (payload.type === "done") {
              // stop after done
              if (ctrl.current) ctrl.current.abort();
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (e: unknown) {
      if ((e as { name?: string })?.name !== "AbortError") {
        const message = typeof e === "object" && e && 'message' in e ? String((e as any).message) : "Stream error";
        setError(message);
      }
    } finally {
      setRunning(false);
    }
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canStart) return;
    startGeneration(e.currentTarget);
  }

  function onCancel() {
    if (ctrl.current) {
      ctrl.current.abort();
      ctrl.current = null;
    }
    setRunning(false);
  }

  return (
    <div className="space-y-4">
      <h3 className="text-md font-semibold">AI Generate Win Statements</h3>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
        <div>
          <label className="block text-sm font-medium">Context hint</label>
          <input name="context_hint" className="w-full border rounded px-2 py-1" placeholder="Key priorities, materials, end uses..." />
        </div>
        <div>
          <label className="block text-sm font-medium">Tone</label>
          <select name="tone" className="w-full border rounded px-2 py-1">
            <option value="">Default</option>
            <option value="concise">Concise</option>
            <option value="persuasive">Persuasive</option>
            <option value="neutral">Neutral</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Count</label>
          <input type="number" name="count" min={1} max={10} defaultValue={3} className="w-full border rounded px-2 py-1" />
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={!canStart} className="bg-primary text-white px-3 py-1.5 rounded">
            {running ? "Running..." : "Generate"}
          </button>
          {running && (
            <button type="button" onClick={onCancel} className="bg-muted text-foreground px-3 py-1.5 rounded">
              Cancel
            </button>
          )}
        </div>
      </form>

      {context.length > 0 && (
        <div>
          <div className="text-sm font-medium mb-1">Context sources</div>
          <ul className="list-disc pl-5 text-sm space-y-0.5">
            {context.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <div className="text-sm font-medium mb-1">Suggestions</div>
        {suggestions.length === 0 && (
          <div className="text-sm text-muted-foreground">None yet.</div>
        )}
        <div className="space-y-2">
          {suggestions.map((s, i) => (
            <div key={i} className="border rounded p-3">
              <div className="text-sm whitespace-pre-wrap">{s.text}</div>
              {s.sources && s.sources.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">{s.sources.join("  •  ")}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
