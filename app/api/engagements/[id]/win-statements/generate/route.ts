import { createClient } from "@/lib/supabase/server";
// Pinecone minimal types
type PineconeDoc = {
  id: string;
  score: number;
  text: string;
  metadata: { title?: string; filename?: string; url?: string };
};

// Generic namespace search for selected additional namespaces
const searchPineconeNamespace = async (
  query: string,
  namespace: 'ellen-frameworks' | 'companies' | 'materials' | 'end_uses'
): Promise<PineconeDoc[]> => {
  try {
    const res = await fetch(
      `https://strategic-materials-intel-x1l8cyh.svc.aped-4627-b74a.pinecone.io/records/namespaces/${namespace}/search`,
      {
        method: "POST",
        headers: {
          "Api-Key": process.env.PINECONE_API_KEY || "",
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-Pinecone-API-Version": "unstable",
        },
        body: JSON.stringify({
          query: { inputs: { text: query }, top_k: 3 },
          fields: ["text", "title", "filename", "url"],
        }),
      }
    );
    if (!res.ok) {
      console.error(`Pinecone search error for ${namespace}:`, await res.text());
      return [];
    }
    const data = await res.json();
    const hits = (data?.result?.hits || []) as Array<{
      _id: string;
      _score?: number;
      fields: { text?: string; title?: string; filename?: string; url?: string };
    }>;
    return hits.map((h) => ({
      id: h._id,
      score: h._score || 0,
      text: h.fields?.text || "",
      metadata: { title: h.fields?.title, filename: h.fields?.filename, url: h.fields?.url },
    }));
  } catch (e) {
    console.error(`Pinecone search exception for ${namespace}:`, e);
    return [];
  }
};

const searchPineconeDocuments = async (query: string): Promise<PineconeDoc[]> => {
  try {
    const res = await fetch(
      `https://strategic-materials-intel-x1l8cyh.svc.aped-4627-b74a.pinecone.io/records/namespaces/documents/search`,
      {
        method: "POST",
        headers: {
          "Api-Key": process.env.PINECONE_API_KEY || "",
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-Pinecone-API-Version": "unstable",
        },
        body: JSON.stringify({
          query: { inputs: { text: query }, top_k: 4 },
          fields: ["text", "title", "filename", "url"],
        }),
      }
    );

    if (!res.ok) {
      console.error("Pinecone documents search error:", await res.text());
      return [];
    }
    const data = await res.json();
    const hits = (data?.result?.hits || []) as Array<{
      _id: string;
      _score?: number;
      fields: { text?: string; title?: string; filename?: string; url?: string };
    }>;
    return hits.map((h) => ({
      id: h._id,
      score: h._score || 0,
      text: h.fields?.text || "",
      metadata: { title: h.fields?.title, filename: h.fields?.filename, url: h.fields?.url },
    }));
  } catch (e) {
    console.error("Pinecone documents search exception:", e);
    return [];
  }
};

// POST /api/engagements/:id/win-statements/generate — stream AI-like suggestions (MVP: DB-only context)
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  
  type GenerateHints = {
    context_hint?: string;
    tone?: "concise" | "persuasive" | "neutral";
    count?: number;
  };
  const hints: GenerateHints = await req.json().catch(() => ({} as GenerateHints));

  const { data: auth, error: userErr } = await supabase.auth.getUser();
  if (userErr || !auth?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Rate limiting: 5 requests per minute per user
  const userId = auth.user.id;
  const WINDOW_MS = 60_000;
  const LIMIT = 5;
  const sinceIso = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count: recentCount } = await supabase
    .from("api_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("endpoint", "win_statements_generate")
    .gte("created_at", sinceIso);
  if ((recentCount ?? 0) >= LIMIT) {
    return new Response(JSON.stringify({ error: "Too Many Requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }
  await supabase.from("api_usage").insert({ user_id: userId, endpoint: "win_statements_generate" });

  // Verify parent engagement access
  const { data: engagement, error: eErr } = await supabase
    .from("engagements")
    .select("id,title,meeting_datetime,topic,objectives,org_counterparty,location,notes")
    .eq("id", id)
    .single();
  if (eErr || !engagement) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: participants } = await supabase
    .from("engagement_participants")
    .select("name,role_title,organization,is_internal")
    .eq("engagement_id", id)
    .order("created_at", { ascending: true });

  // Build a compact query string for vector search
  const objectiveStr = Array.isArray(engagement.objectives) ? (engagement.objectives as string[]).join("; ") : "";
  const rawQuery = [engagement.title, engagement.topic, objectiveStr, hints.context_hint]
    .filter(Boolean)
    .join(" | ")
    .slice(0, 500);
  // Decide conditional namespaces
  const qLower = (rawQuery || '').toLowerCase();
  const likelyMaterials = /material|alloy|metal|mineral|compound|oxide|sulfide|battery|cathode|anode/.test(qLower);
  const marketish = /customer|market|product|application|use case|end use|go-to-market|sales|buyers?/.test(qLower);

  // Fetch Pinecone contexts in parallel: documents + frameworks + companies (+ optional)
  const pineconePromises: Array<Promise<PineconeDoc[]>> = [];
  if (rawQuery) {
    pineconePromises.push(searchPineconeDocuments(rawQuery));
    pineconePromises.push(searchPineconeNamespace(rawQuery, 'ellen-frameworks'));
    pineconePromises.push(searchPineconeNamespace(rawQuery, 'companies'));
    if (likelyMaterials) pineconePromises.push(searchPineconeNamespace(rawQuery, 'materials'));
    if (marketish) pineconePromises.push(searchPineconeNamespace(rawQuery, 'end_uses'));
  }
  const pineconeResults = await Promise.all(pineconePromises);
  const pineconeDocs = pineconeResults.flat().slice(0, 10);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, payload: unknown) => {
        const line = `event: ${event}\n` + `data: ${JSON.stringify(payload)}\n\n`;
        controller.enqueue(encoder.encode(line));
      };

      // Emit context summary first
      send("context", {
        id,
        title: engagement.title,
        topic: engagement.topic,
        objectives: engagement.objectives ?? [],
        participants: (participants ?? []).map(p => ({
          name: p.name,
          role_title: p.role_title,
          organization: p.organization,
          is_internal: p.is_internal,
        })),
        sources: [
          { tag: "[DB-X]", ref: `engagement:${id}` },
          { tag: "[DB-X]", ref: `participants:${id}` },
          ...pineconeDocs.slice(0, 3).map(d => ({
            tag: "[VEC-X]",
            ref: `doc:${(d.metadata.title || d.metadata.filename || d.id).toString().slice(0,80)}`
          })),
        ],
      });

      // Basic heuristic suggestions (MVP). In a later pass, augment with Pinecone/web.
      const count = Math.min(Math.max(Number(hints?.count) || 3, 1), 5);

      const objectives = Array.isArray(engagement.objectives)
        ? (engagement.objectives as string[])
        : [];
      const primaryGoal = objectives[0] || engagement.topic || "Align on next steps";
      const counterparty = engagement.org_counterparty || "the counterparty";

      for (let i = 0; i < count; i++) {
        const win_if = i === 0
          ? `We leave with agreement to ${primaryGoal.toLowerCase()}.`
          : `We establish a clear, time-bound owner and plan for ${primaryGoal.toLowerCase()}.`;
        const wiift = `Reduced uncertainty and a concrete path forward for ${counterparty}.`;
        const wiifm = `Clarity on decisions, owners, and next steps to accelerate progress.`;

        send("suggestion", {
          win_if,
          wiift,
          wiifm,
          sources: [
            { tag: "[DB-X]", ref: `engagement:${id}` },
            ...pineconeDocs.slice(0, 2).map(d => ({
              tag: "[VEC-X]",
              ref: `doc:${(d.metadata.title || d.metadata.filename || d.id).toString().slice(0,80)}`
            })),
          ],
        });
        // small cadence to improve UX
        await new Promise(r => setTimeout(r, 50));
      }

      send("done", { ok: true });
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
