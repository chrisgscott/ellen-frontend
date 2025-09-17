import { createClient } from "@/lib/supabase/server";
import React from "react";
import Image from "next/image";
import type { Participant } from "@/components/engagements/engagement-detail-editor";

export const dynamic = "force-dynamic";

export default async function EngagementPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold mb-2">Engagement Report</h1>
        <p className="text-sm text-muted-foreground">Please sign in to view this report.</p>
      </div>
    );
  }

  const { data: engagement } = await supabase
    .from("engagements")
    .select("id,title,topic,meeting_datetime,duration_minutes,location,org_counterparty,objectives,notes,isp_md,created_at")
    .eq("id", id)
    .single();

  const { data: participants } = await supabase
    .from("engagement_participants")
    .select("id,name,role_title,organization,is_internal,created_at")
    .eq("engagement_id", id)
    .order("created_at", { ascending: true });

  if (!engagement) {
    return (
      <div className="p-8">
        <h1 className="text-xl font-semibold mb-2">Engagement Report</h1>
        <p className="text-sm text-red-600">Not found.</p>
      </div>
    );
  }

  const whenStr = engagement.meeting_datetime ? new Date(engagement.meeting_datetime).toLocaleString() : "TBD";
  const durationStr = typeof engagement.duration_minutes === "number" ? `${engagement.duration_minutes} minutes` : "—";
  const objectives = Array.isArray(engagement.objectives) ? engagement.objectives : [];

  return (
    <div className="report font-sans text-gray-900 bg-white">
      {/* Letterhead */}
      <div className="mx-auto max-w-3xl px-8 py-10">
        <header className="mb-6">
          <div className="flex items-center gap-4">
            <Image src="/opengraph-image.png" alt="ELLEN" width={160} height={40} />
            <div className="text-sm">
              <div className="font-semibold">ELLEN Intelligence</div>
              <div>123 Main St, City, ST 00000</div>
              <div>(000) 000-0000 • ellen.ai</div>
            </div>
          </div>
        </header>

        {/* Title */}
        <section className="mb-4">
          <h1 className="text-3xl font-bold leading-tight">{engagement.title || "Engagement Summary"}</h1>
          <div className="text-sm text-gray-600">{new Date().toLocaleDateString()} • ID: {engagement.id}</div>
        </section>

        {/* Metadata */}
        <section className="mb-6">
          <table className="w-full text-sm border border-gray-300">
            <tbody>
              <tr className="odd:bg-gray-50">
                <td className="w-40 font-medium border-r border-gray-300 p-2">When</td>
                <td className="p-2">{whenStr}</td>
                <td className="w-40 font-medium border-r border-gray-300 p-2">Location</td>
                <td className="p-2">{engagement.location || "—"}</td>
              </tr>
              <tr className="odd:bg-gray-50">
                <td className="font-medium border-r border-gray-300 p-2">Duration</td>
                <td className="p-2">{durationStr}</td>
                <td className="font-medium border-r border-gray-300 p-2">Counterparty</td>
                <td className="p-2">{engagement.org_counterparty || "—"}</td>
              </tr>
              <tr className="odd:bg-gray-50">
                <td className="font-medium border-r border-gray-300 p-2">Topic</td>
                <td className="p-2">{engagement.topic || "—"}</td>
                <td className="font-medium border-r border-gray-300 p-2">Participants</td>
                <td className="p-2">{(participants || []).length} total</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Executive Summary (if report md exists, show first section) */}
        <section className="mb-5">
          <h2 className="text-xl font-semibold mb-2">Executive Summary</h2>
          <p className="text-[12pt] leading-relaxed">
            {(engagement.notes || "").trim() || "Summary of engagement objectives, context, and key outcomes."}
          </p>
        </section>

        {/* Objectives */}
        <section className="mb-5 break-inside-avoid">
          <h2 className="text-xl font-semibold mb-2">Objectives</h2>
          <ul className="list-disc pl-6 space-y-1 text-[12pt]">
            {objectives.length > 0 ? (
              objectives.map((o: string, i: number) => <li key={i}>{o}</li>)
            ) : (
              <li className="text-gray-600">—</li>
            )}
          </ul>
        </section>

        {/* Participants */}
        <section className="mb-5 break-inside-avoid">
          <h2 className="text-xl font-semibold mb-2">Participants</h2>
          <table className="w-full text-sm border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-2 border-r border-gray-300">Name</th>
                <th className="text-left p-2 border-r border-gray-300">Role/Title</th>
                <th className="text-left p-2 border-r border-gray-300">Organization</th>
                <th className="text-left p-2">Type</th>
              </tr>
            </thead>
            <tbody>
              {(participants || []).map((p: Participant) => (
                <tr key={p.id} className="odd:bg-gray-50">
                  <td className="p-2 border-r border-gray-300">{p.name}</td>
                  <td className="p-2 border-r border-gray-300">{p.role_title || "—"}</td>
                  <td className="p-2 border-r border-gray-300">{p.organization || "—"}</td>
                  <td className="p-2">{p.is_internal ? "Internal" : "External"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Decisions */}
        <section className="mb-5 break-inside-avoid">
          <h2 className="text-xl font-semibold mb-2">Decisions</h2>
          <ul className="list-disc pl-6 space-y-1 text-[12pt]"><li>—</li></ul>
        </section>

        {/* Action Items */}
        <section className="mb-5 break-inside-avoid">
          <h2 className="text-xl font-semibold mb-2">Action Items</h2>
          <table className="w-full text-sm border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-2 border-r border-gray-300">Action</th>
                <th className="text-left p-2 border-r border-gray-300">Owner</th>
                <th className="text-left p-2 border-r border-gray-300">Due</th>
                <th className="text-left p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-2 border-r border-gray-300">—</td>
                <td className="p-2 border-r border-gray-300">—</td>
                <td className="p-2 border-r border-gray-300">—</td>
                <td className="p-2">—</td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Risks & Issues */}
        <section className="mb-5 break-inside-avoid">
          <h2 className="text-xl font-semibold mb-2">Risks & Issues</h2>
          <ul className="list-disc pl-6 space-y-1 text-[12pt]"><li>—</li></ul>
        </section>

        {/* Footer */}
        <footer className="text-xs text-gray-600 mt-8">
          <div className="flex justify-between">
            <div>Confidential — Internal Use Only</div>
            <div>ellen.ai</div>
          </div>
        </footer>
      </div>
    </div>
  );
}
