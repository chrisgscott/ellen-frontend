import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/engagements/:id/agenda-items/:itemId
// DELETE /api/engagements/:id/agenda-items/:itemId
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; itemId: string } }
) {
  const supabase = await createClient();
  const body = await req.json().catch(() => ({}));
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ensure parent access
  const { error: parentErr } = await supabase
    .from("engagements").select("id").eq("id", params.id).single();
  if (parentErr) return NextResponse.json({ error: "Not found" }, { status: 404 });

  type AgendaUpdate = {
    title?: string;
    detail?: string | null;
    order_index?: number;
    duration_minutes?: number | null;
  };

  const updates: AgendaUpdate = {};
  if ("title" in body) updates.title = String(body.title);
  if ("detail" in body) updates.detail = body.detail ?? null;
  if ("order_index" in body)
    updates.order_index =
      typeof body.order_index === "number" ? body.order_index : undefined;
  if ("duration_minutes" in body)
    updates.duration_minutes =
      typeof body.duration_minutes === "number" ? body.duration_minutes : null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, agenda_item: null });
  }

  const { data, error } = await supabase
    .from("engagement_agenda_items")
    .update(updates)
    .eq("id", params.itemId)
    .eq("engagement_id", params.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ agenda_item: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; itemId: string } }
) {
  const supabase = await createClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ensure parent access
  const { error: parentErr } = await supabase
    .from("engagements").select("id").eq("id", params.id).single();
  if (parentErr) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase
    .from("engagement_agenda_items")
    .delete()
    .eq("id", params.itemId)
    .eq("engagement_id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
