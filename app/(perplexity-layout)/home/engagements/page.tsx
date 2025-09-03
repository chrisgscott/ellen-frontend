import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { CreateEngagementForm } from "@/components/engagements/create-form";

export const dynamic = "force-dynamic";

export default async function EngagementsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold mb-2">Engagements</h1>
        <p className="text-sm text-muted-foreground">Please sign in to view your engagements.</p>
      </div>
    );
  }

  const { data: engagements, error } = await supabase
    .from("engagements")
    .select("id,title,topic,meeting_datetime,org_counterparty,updated_at")
    .order("updated_at", { ascending: false });

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <h1 className="text-xl font-semibold mb-3">Engagements</h1>
        {error && (
          <div className="text-sm text-red-600 mb-2">{error.message}</div>
        )}
        <div className="space-y-2">
          {(engagements ?? []).length === 0 && (
            <div className="text-sm text-muted-foreground">No engagements yet.</div>
          )}
          {(engagements ?? []).map((e) => (
            <Link
              key={e.id}
              href={`/home/engagements/${e.id}`}
              className="block border rounded p-3 hover:bg-accent"
            >
              <div className="font-medium">{e.title}</div>
              <div className="text-xs text-muted-foreground">
                {e.topic ?? "—"} • {e.org_counterparty ?? "—"}
              </div>
              <div className="text-xs text-muted-foreground">
                {e.meeting_datetime ? new Date(e.meeting_datetime).toLocaleString() : "TBD"}
              </div>
            </Link>
          ))}
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold mb-3">Create New Engagement</h2>
        <CreateEngagementForm />
      </div>
    </div>
  );
}
