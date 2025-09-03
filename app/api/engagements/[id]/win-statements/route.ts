import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/engagements/:id/win-statements — list
// POST /api/engagements/:id/win-statements — create
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error: parentErr } = await supabase
    .from("engagements").select("id").eq("id", id).single();
  if (parentErr) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("engagement_win_statements")
    .select("*")
    .eq("engagement_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ win_statements: data ?? [] });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const body = await req.json().catch(() => ({}));
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error: parentErr } = await supabase
    .from("engagements").select("id").eq("id", id).single();
  if (parentErr) return NextResponse.json({ error: "Not found" }, { status: 404 });

  type InsertWin = {
    engagement_id: string;
    win_if?: string | null;
    wiift?: string | null;
    wiifm?: string | null;
  };

  const payload: InsertWin = {
    engagement_id: id,
    win_if: body.win_if ?? null,
    wiift: body.wiift ?? null,
    wiifm: body.wiifm ?? null,
  };

  const { data, error } = await supabase
    .from("engagement_win_statements")
    .insert(payload)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ win_statement: data }, { status: 201 });
}
