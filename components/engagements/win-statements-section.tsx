"use client";
import React from "react";

type WinStatement = {
  id?: string;
  win_if: string;
  wiift: string;
  wiifm: string;
  created_at?: string;
};

export function WinStatementsSection({ initial }: { engagementId: string; initial: WinStatement[] }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-md font-semibold mb-2">Win Statements</h3>
        <div className="space-y-2">
          {initial.length === 0 && (
            <div className="text-sm text-muted-foreground">None yet.</div>
          )}
          {initial.map((w, idx) => (
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
    </div>
  );
}
