import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/engagements/:id/participants/:participantId
// DELETE /api/engagements/:id/participants/:participantId
export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string; participantId: string }> }
) {
  const { id, participantId } = await ctx.params;
  const supabase = await createClient();
  const body = await req.json().catch(() => ({}));
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ensure parent access
  const { error: parentErr } = await supabase
    .from("engagements").select("id").eq("id", id).single();
  if (parentErr) return NextResponse.json({ error: "Not found" }, { status: 404 });

  type ParticipantUpdate = {
    name?: string;
    person_id?: string | null;
    role_title?: string | null;
    organization?: string | null;
    email?: string | null;
    is_internal?: boolean;
    notes?: string | null;
  };

  const updates: ParticipantUpdate = {};
  if ("name" in body) updates.name = String(body.name);
  if ("person_id" in body) updates.person_id = body.person_id ?? null;
  if ("role_title" in body) updates.role_title = body.role_title ?? null;
  if ("organization" in body) updates.organization = body.organization ?? null;
  if ("email" in body) updates.email = body.email ?? null;
  if ("is_internal" in body) updates.is_internal = Boolean(body.is_internal);
  if ("notes" in body) updates.notes = body.notes ?? null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, participant: null });
  }

  const { data, error } = await supabase
    .from("engagement_participants")
    .update(updates)
    .eq("id", participantId)
    .eq("engagement_id", id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ participant: data });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string; participantId: string }> }
) {
  const { id, participantId } = await ctx.params;
  const supabase = await createClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ensure parent access
  const { error: parentErr } = await supabase
    .from("engagements").select("id").eq("id", id).single();
  if (parentErr) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase
    .from("engagement_participants")
    .delete()
    .eq("id", participantId)
    .eq("engagement_id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
