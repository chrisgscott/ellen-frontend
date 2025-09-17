import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/engagements/:id/win-statements/bulk — create many
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
  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Ensure parent engagement exists and is accessible via RLS
  const { error: parentErr } = await supabase
    .from("engagements")
    .select("id")
    .eq("id", id)
    .single();
  if (parentErr) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const items = Array.isArray(body?.items) ? (body.items as unknown[]) : [];
  const texts = items
    .map((x) => {
      if (typeof x === "string") return x;
      if (x && typeof x === "object" && "text" in (x as Record<string, unknown>)) {
        const t = (x as { text?: unknown }).text;
        return typeof t === "string" ? t : undefined;
      }
      return undefined;
    })
    .filter((s): s is string => !!s && s.trim().length > 0)
    .map((s) => s.trim());

  if (texts.length === 0) {
    return NextResponse.json({ error: "No items to insert" }, { status: 400 });
  }

  const payload = texts.map((t) => ({
    engagement_id: id,
    win_if: t,
  }));

  const { data, error } = await supabase
    .from("engagement_win_statements")
    .insert(payload)
    .select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ win_statements: data ?? [] }, { status: 201 });
}
