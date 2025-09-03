import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/engagements/:id/participants — list participants
// POST /api/engagements/:id/participants — add participant
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ensure parent access
  const { error: parentErr } = await supabase
    .from("engagements")
    .select("id")
    .eq("id", id)
    .single();
  if (parentErr) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("engagement_participants")
    .select("*")
    .eq("engagement_id", id)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ participants: data ?? [] });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const body = await req.json().catch(() => ({}));
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Ensure parent access
  const { error: parentErr } = await supabase
    .from("engagements")
    .select("id")
    .eq("id", id)
    .single();
  if (parentErr) return NextResponse.json({ error: "Not found" }, { status: 404 });

  type InsertParticipant = {
    engagement_id: string;
    person_id?: string | null;
    name: string;
    role_title?: string | null;
    organization?: string | null;
    email?: string | null;
    is_internal?: boolean;
    notes?: string | null;
  };

  const payload: InsertParticipant = {
    engagement_id: id,
    name: String(body.name ?? ""),
    person_id: body.person_id ?? null,
    role_title: body.role_title ?? null,
    organization: body.organization ?? null,
    email: body.email ?? null,
    is_internal: Boolean(body.is_internal ?? false),
    notes: body.notes ?? null,
  };
  if (!payload.name) return NextResponse.json({ error: "name required" }, { status: 400 });

  const { data, error } = await supabase
    .from("engagement_participants")
    .insert(payload)
    .select("*")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ participant: data }, { status: 201 });
}
