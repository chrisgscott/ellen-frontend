import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/engagements — list current user's engagements
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("engagements")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ engagements: data ?? [] });
}

// POST /api/engagements — create engagement (owner_user_id = auth.uid())
export async function POST(req: Request) {
  const supabase = await createClient();
  const body = await req.json().catch(() => ({}));

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = {
    title: String(body.title ?? "Untitled Engagement"),
    meeting_datetime: body.meeting_datetime ?? null,
    duration_minutes: body.duration_minutes ?? null,
    location: body.location ?? null,
    topic: body.topic ?? null,
    org_counterparty: body.org_counterparty ?? null,
    objectives: Array.isArray(body.objectives) ? body.objectives : null,
    notes: body.notes ?? null,
    metadata: body.metadata ?? {},
    // owner_user_id must match auth.uid() to satisfy RLS insert check
    owner_user_id: user.id,
  } as const;

  const { data, error } = await supabase
    .from("engagements")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ engagement: data }, { status: 201 });
}
