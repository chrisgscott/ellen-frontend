"use client";
import React, { useState } from "react";

type WinStatement = {
  id?: string;
  win_if: string;
  wiift: string;
  wiifm: string;
  created_at?: string;
};

export function WinStatementsSection({ engagementId, initial }: { engagementId: string; initial: WinStatement[] }) {
  const [items, setItems] = useState<WinStatement[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const payload = {
      win_if: String(fd.get("win_if") || "").trim(),
      wiift: String(fd.get("wiift") || "").trim(),
      wiifm: String(fd.get("wiifm") || "").trim(),
    };
    if (!payload.win_if || !payload.wiift || !payload.wiifm) {
      setLoading(false);
      setError("All fields are required.");
      return;
    }
    const res = await fetch(`/api/engagements/${engagementId}/win-statements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data?.error || "Failed to add win statement");
      return;
    }
    if (data?.win_statement) {
      setItems((prev) => [...prev, data.win_statement]);
      (e.target as HTMLFormElement).reset();
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-md font-semibold mb-2">Win Statements</h3>
        <div className="space-y-2">
          {items.length === 0 && (
            <div className="text-sm text-muted-foreground">None yet.</div>
          )}
          {items.map((w, idx) => (
            <div key={w.id || idx} className="border rounded p-3">
              <div className="text-sm"><span className="font-medium">WIN IF:</span> {w.win_if}</div>
              <div className="text-sm"><span className="font-medium">WIIFT:</span> {w.wiift}</div>
              <div className="text-sm"><span className="font-medium">WIIFM:</span> {w.wiifm}</div>
              {w.created_at && (
                <div className="text-xs text-muted-foreground mt-1">{new Date(w.created_at).toLocaleString()}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      <form onSubmit={onAdd} className="space-y-2">
        {error && <div className="text-sm text-red-600">{error}</div>}
        <div>
          <label className="block text-sm font-medium">WIN IF</label>
          <input name="win_if" className="w-full border rounded px-2 py-1" placeholder="We secure agreement to..." />
        </div>
        <div>
          <label className="block text-sm font-medium">WIIFT</label>
          <input name="wiift" className="w-full border rounded px-2 py-1" placeholder="Reduced uncertainty for the counterparty by..." />
        </div>
        <div>
          <label className="block text-sm font-medium">WIIFM</label>
          <input name="wiifm" className="w-full border rounded px-2 py-1" placeholder="Clarity and speed for us by..." />
        </div>
        <button type="submit" disabled={loading} className="bg-primary text-white px-3 py-1.5 rounded">
          {loading ? "Adding..." : "Add Win Statement"}
        </button>
      </form>
    </div>
  );
}
