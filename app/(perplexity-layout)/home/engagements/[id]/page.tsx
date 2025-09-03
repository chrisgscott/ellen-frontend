import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { WinStatementsSection } from "@/components/engagements/win-statements-section";
import { WinGenerateSection } from "@/components/engagements/win-generate-section";

type WinStatement = {
  id: string;
  win_if: string;
  wiift: string;
  wiifm: string;
  created_at?: string;
};

export const dynamic = "force-dynamic";

export default async function EngagementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-2">Engagement</h1>
        <p className="text-sm text-muted-foreground">Please sign in to view this engagement.</p>
      </div>
    );
  }

  const { data: engagement, error: eErr } = await supabase
    .from("engagements")
    .select("id,title,topic,meeting_datetime,duration_minutes,location,org_counterparty,objectives,notes,created_at,updated_at")
    .eq("id", id)
    .single();

  if (eErr || !engagement) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-2">Engagement</h1>
        <p className="text-sm text-red-600">Not found.</p>
        <Link href="/home/engagements" className="text-primary underline text-sm">Back to engagements</Link>
      </div>
    );
  }

  const { data: participants } = await supabase
    .from("engagement_participants")
    .select("id,name,role_title,organization,is_internal,created_at")
    .eq("engagement_id", id)
    .order("created_at", { ascending: true });

  const { data: winStatements } = await supabase
    .from("engagement_win_statements")
    .select("id,win_if,wiift,wiifm,created_at")
    .eq("engagement_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{engagement.title}</h1>
          <div className="text-sm text-muted-foreground">Engagement ID: {id}</div>
        </div>
        <Link href="/home/engagements" className="text-primary underline text-sm">Back to engagements</Link>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Details</h2>
          <div className="text-sm"><span className="font-medium">Topic:</span> {engagement.topic ?? "—"}</div>
          <div className="text-sm"><span className="font-medium">Counterparty:</span> {engagement.org_counterparty ?? "—"}</div>
          <div className="text-sm"><span className="font-medium">When:</span> {engagement.meeting_datetime ? new Date(engagement.meeting_datetime).toLocaleString() : "TBD"}</div>
          <div className="text-sm"><span className="font-medium">Duration:</span> {engagement.duration_minutes ?? "—"} min</div>
          <div className="text-sm"><span className="font-medium">Location:</span> {engagement.location ?? "—"}</div>
          <div className="text-sm"><span className="font-medium">Objectives:</span> {(Array.isArray(engagement.objectives) ? engagement.objectives : []).join(", ") || "—"}</div>
          <div className="text-sm"><span className="font-medium">Notes:</span> {engagement.notes ?? "—"}</div>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Participants</h2>
          <div className="space-y-1">
            {(participants ?? []).length === 0 && (
              <div className="text-sm text-muted-foreground">No participants listed.</div>
            )}
            {(participants ?? []).map((p) => (
              <div key={p.id} className="text-sm">
                <span className="font-medium">{p.name}</span> — {p.role_title ?? ""} {p.organization ? `@ ${p.organization}` : ""} {p.is_internal ? "(internal)" : ""}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <WinStatementsSection engagementId={id} initial={(winStatements ?? []) as WinStatement[]} />
      </section>

      <section>
        <WinGenerateSection engagementId={id} />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Support Package</h2>
        <div className="text-sm text-muted-foreground">This section will display the latest generated info package (summary, sources). For now, use the API to generate: POST /api/engagements/{id}/support-package.</div>
      </section>
    </div>
  );
}
