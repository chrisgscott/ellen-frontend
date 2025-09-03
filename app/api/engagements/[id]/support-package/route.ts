import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/engagements/:id/support-package — generate & save dossier (v1: DB-driven)
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ensure access to parent engagement via RLS and fetch key fields
  const { data: engagement, error: eErr } = await supabase
    .from("engagements")
    .select("id,title,meeting_datetime,org_counterparty,location,topic,objectives,notes")
    .eq("id", id)
    .single();
  if (eErr || !engagement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [{ data: participants }, { data: wins }, { data: agenda }] = await Promise.all([
    supabase
      .from("engagement_participants")
      .select("name,role_title,organization,is_internal")
      .eq("engagement_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("engagement_win_statements")
      .select("win_if,wiift,wiifm")
      .eq("engagement_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("engagement_agenda_items")
      .select("title,detail,order_index,duration_minutes")
      .eq("engagement_id", id)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);

  const body = await req.json().catch(() => ({} as Record<string, unknown>));
  const userNotes: string = typeof body.user_notes === "string" ? body.user_notes : "";

  // Compose summary and dossier from DB data (no AI yet)
  const title = engagement.title ?? "Engagement";
  const when = engagement.meeting_datetime ? new Date(engagement.meeting_datetime).toLocaleString() : "TBD";
  const where = engagement.location ?? "TBD";
  const who = participants?.map(p => `- ${p.name || "Unknown"} (${p.role_title || ""}) ${p.organization ? "— " + p.organization : ""}${p.is_internal ? " [Internal]" : ""}`).join("\n") || "- (none)";
  const objectives = (engagement.objectives ?? []).join("; ") || "(none)";
  const winBullets = wins?.map((w, i) => `- Win ${i + 1}: ${w.win_if || "—"}\n  - WIIFT: ${w.wiift || "—"}\n  - WIIFM: ${w.wiifm || "—"}`).join("\n") || "- (none)";
  const agendaLines = agenda?.map((a, i) => `- ${a.order_index ?? i + 1}. ${a.title || "Untitled"} (${a.duration_minutes ?? "?"}m)${a.detail ? ": " + a.detail : ""}`).join("\n") || "- (none)";

  const summary_md = `# ${title}\n\n- When: ${when}\n- Where: ${where}\n- Counterparty: ${engagement.org_counterparty ?? "TBD"}\n- Topic: ${engagement.topic ?? "—"}\n- Objectives: ${objectives}`;

  const dossier_md = `# Support Package\n\n## Participants\n${who}\n\n## Win Statements\n${winBullets}\n\n## Agenda\n${agendaLines}\n\n## Notes\n${(engagement.notes ?? "").toString() || "(none)"}\n\n## Additional User Notes\n${userNotes || "(none)"}`;

  const sources: Array<{ type: string; ref: string }> = [];
  // Placeholder: later populate with RAG sources [DOC-X]/[VEC-X]/[DB-X]

  const { data, error } = await supabase
    .from("engagement_support_packages")
    .insert({
      engagement_id: id,
      summary_md,
      dossier_md,
      sources,
      generated_at: new Date().toISOString(),
      model_meta: { strategy: "db_compose_v1" },
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ support_package: data }, { status: 201 });
}
