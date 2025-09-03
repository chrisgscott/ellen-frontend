import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/engagements/:id — fetch single engagement
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
  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("engagements")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    // If no row due to RLS or not found, return 404
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ engagement: data });
}

// PATCH /api/engagements/:id — update allowed fields
export async function PATCH(
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
  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Only permit updatable fields; do not allow owner_user_id change
  type EngagementUpdate = {
    title?: string;
    meeting_datetime?: string | null;
    duration_minutes?: number | null;
    location?: string | null;
    topic?: string | null;
    org_counterparty?: string | null;
    objectives?: string[] | null;
    notes?: string | null;
    metadata?: Record<string, unknown> | null;
  };

  const updates: EngagementUpdate = {};

  if ("title" in body) updates.title = String(body.title);
  if ("meeting_datetime" in body)
    updates.meeting_datetime = body.meeting_datetime ?? null;
  if ("duration_minutes" in body)
    updates.duration_minutes =
      typeof body.duration_minutes === "number" ? body.duration_minutes : null;
  if ("location" in body)
    updates.location =
      typeof body.location === "string" ? body.location : body.location ?? null;
  if ("topic" in body)
    updates.topic =
      typeof body.topic === "string" ? body.topic : body.topic ?? null;
  if ("org_counterparty" in body)
    updates.org_counterparty =
      typeof body.org_counterparty === "string"
        ? body.org_counterparty
        : body.org_counterparty ?? null;
  if ("objectives" in body)
    updates.objectives = Array.isArray(body.objectives)
      ? (body.objectives as string[])
      : null;
  if ("notes" in body)
    updates.notes = typeof body.notes === "string" ? body.notes : body.notes ?? null;
  if ("metadata" in body)
    updates.metadata =
      (body.metadata as Record<string, unknown>) ?? ({} as Record<string, unknown>);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: true, engagement: null });
  }

  const { data, error } = await supabase
    .from("engagements")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    // Likely RLS or validation
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ engagement: data });
}
