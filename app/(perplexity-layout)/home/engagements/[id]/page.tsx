import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { EngagementDetailEditor } from "@/components/engagements/engagement-detail-editor";
// Simplified details view using a single edit-all component

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
    .select("id,title,topic,meeting_datetime,duration_minutes,location,org_counterparty,objectives,notes,isp_md,created_at,updated_at")
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

  return (
    <div className="p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">&nbsp;</div>
          <Link href="/home/engagements" className="text-primary underline text-sm">Back to engagements</Link>
        </div>
        <EngagementDetailEditor engagement={engagement} participants={participants || []} />
      </div>
    </div>
  );
}
