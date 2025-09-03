import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/engagements/:id/agenda-items — list
// POST /api/engagements/:id/agenda-items — create
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error: parentErr } = await supabase
    .from("engagements").select("id").eq("id", params.id).single();
  if (parentErr) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("engagement_agenda_items")
    .select("*")
    .eq("engagement_id", params.id)
    .order("order_index", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ agenda_items: data ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient();
  const body = await req.json().catch(() => ({}));
  const { data: { user }, error: userErr } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error: parentErr } = await supabase
    .from("engagements").select("id").eq("id", params.id).single();
  if (parentErr) return NextResponse.json({ error: "Not found" }, { status: 404 });

  type InsertAgenda = {
    engagement_id: string;
    title: string;
    detail?: string | null;
    order_index?: number;
    duration_minutes?: number | null;
  };

  const payload: InsertAgenda = {
    engagement_id: params.id,
    title: String(body.title ?? ""),
    detail: body.detail ?? null,
    order_index: typeof body.order_index === "number" ? body.order_index : 0,
    duration_minutes:
      typeof body.duration_minutes === "number" ? body.duration_minutes : null,
  };
  if (!payload.title) return NextResponse.json({ error: "title required" }, { status: 400 });

  const { data, error } = await supabase
    .from("engagement_agenda_items")
    .insert(payload)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ agenda_item: data }, { status: 201 });
}
