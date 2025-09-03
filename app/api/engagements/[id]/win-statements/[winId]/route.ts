import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/engagements/:id/win-statements/:winId
// DELETE /api/engagements/:id/win-statements/:winId
export async function PATCH(
  req: Request,
  { params }: { params: { id: string; winId: string } }
) {
  const supabase = await createClient();
  const body = await req.json().catch(() => ({}));
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ensure parent access
  const { error: parentErr } = await supabase
    .from("engagements").select("id").eq("id", params.id).single();
  if (parentErr) return NextResponse.json({ error: "Not found" }, { status: 404 });

  type WinUpdate = {
    win_if?: string | null;
    wiift?: string | null;
    wiifm?: string | null;
  };

  const updates: WinUpdate = {};
  if ("win_if" in body) updates.win_if = body.win_if ?? null;
  if ("wiift" in body) updates.wiift = body.wiift ?? null;
  if ("wiifm" in body) updates.wiifm = body.wiifm ?? null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, win_statement: null });
  }

  const { data, error } = await supabase
    .from("engagement_win_statements")
    .update(updates)
    .eq("id", params.winId)
    .eq("engagement_id", params.id)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ win_statement: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string; winId: string } }
) {
  const supabase = await createClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ensure parent access
  const { error: parentErr } = await supabase
    .from("engagements").select("id").eq("id", params.id).single();
  if (parentErr) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase
    .from("engagement_win_statements")
    .delete()
    .eq("id", params.winId)
    .eq("engagement_id", params.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
