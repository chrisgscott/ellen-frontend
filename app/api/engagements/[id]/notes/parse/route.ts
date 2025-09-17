import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

// POST /api/engagements/:id/notes/parse — SSE stream of parsed artifacts from meeting notes
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createClient();

  const { data: auth, error: userErr } = await supabase.auth.getUser();
  if (userErr || !auth?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Optional body override for notes; otherwise use DB notes
  const body = await req.json().catch(() => ({}));
  const inlineNotes = typeof body?.notes === "string" ? (body.notes as string) : undefined;

  // Rate limit simplistic: 6/min/user
  const userId = auth.user.id;
  const WINDOW_MS = 60_000;
  const LIMIT = 6;
  const sinceIso = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count: recentCount } = await supabase
    .from("api_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("endpoint", "notes_parse")
    .gte("created_at", sinceIso);
  if ((recentCount ?? 0) >= LIMIT) {
    return new Response(JSON.stringify({ error: "Too Many Requests" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }
  await supabase.from("api_usage").insert({ user_id: userId, endpoint: "notes_parse" });

  // Load engagement + notes
  const { data: engagement, error: eErr } = await supabase
    .from("engagements")
    .select("id,title,topic,notes,objectives,org_counterparty")
    .eq("id", id)
    .single();
  if (eErr || !engagement) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  // Helpers: Pinecone multi-namespace search (aligns with chat route approach)
  type PineconeNamespace =
    | "documents"
    | "materials"
    | "ellen-frameworks"
    | "companies"
    | "material_relationships"
    | "end_uses"
    | "processing_facilities";

  type PineconeHit = { _id: string; _score?: number; fields: Record<string, unknown> };
  type PineconeDocument = {
    id: string;
    score: number;
    text: string;
    metadata: Record<string, unknown> & { namespace?: string };
  };

  const toReadableTag = (prefix: string, name?: string | null, maxLen = 40): string => {
    const base = (name || "").toString().trim();
    if (!base) return `[${prefix}]`;
    const cleaned = base
      .replace(/\s+/g, " ")
      .replace(/[\u0000-\u001F\u007F]/g, "")
      .slice(0, maxLen)
      .trim()
      .replace(/\s+/g, "-");
    return `[${prefix}: ${cleaned}]`;
  };

  const searchPineconeNamespace = async (query: string, namespace: PineconeNamespace): Promise<PineconeDocument[]> => {
    try {
      const response = await fetch(
        `https://strategic-materials-intel-x1l8cyh.svc.aped-4627-b74a.pinecone.io/records/namespaces/${namespace}/search`,
        {
          method: "POST",
          headers: {
            "Api-Key": process.env.PINECONE_API_KEY!,
            "Content-Type": "application/json",
            Accept: "application/json",
            "X-Pinecone-API-Version": "unstable",
          },
          body: JSON.stringify({
            query: { inputs: { text: query }, top_k: 3 },
            fields: [
              "text",
              "filename",
              "documentType",
              "enhanced_doc_type",
              "detectedMaterials",
              "detected_materials",
              "geographic_focus",
              "title",
              "url",
              "material_name",
              "properties",
              "applications",
            ],
          }),
        }
      );
      if (!response.ok) {
        console.error(`Pinecone API error for ${namespace}`, await response.text());
        return [];
      }
      const data = await response.json();
      const hits = data.result?.hits || [];
      return (hits as PineconeHit[]).map((hit) => ({
        id: hit._id,
        score: hit._score || 0,
        text: (hit.fields?.text as string) || "",
        metadata: { ...(hit.fields || {}), namespace },
      }));
    } catch (err) {
      console.error(`Pinecone search error for ${namespace}:`, err);
      return [];
    }
  };

  const searchMultipleNamespaces = async (query: string): Promise<PineconeDocument[]> => {
    const namespaces: PineconeNamespace[] = [
      "documents",
      "materials",
      "ellen-frameworks",
      "companies",
      "material_relationships",
      "end_uses",
      "processing_facilities",
    ];
    const results = await Promise.all(namespaces.map((ns) => searchPineconeNamespace(query, ns)));
    return results
      .flat()
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 12);
  };

  const notes = (inlineNotes ?? engagement.notes ?? "").trim();
  const encoder = new TextEncoder();
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, payload: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\n` + `data: ${JSON.stringify(payload)}\n\n`)
        );
      };

      try {
        // Progress + initial context
        send("progress", { stage: "start", message: "Retrieving context..." });

        const queryText = [engagement.title, engagement.topic, notes].filter(Boolean).join("\n\n");
        const pineconeContext = await searchMultipleNamespaces(queryText);

        // Emit context summary + source tags
        const contextSummary = {
          id,
          title: engagement.title,
          topic: engagement.topic,
          notes_len: notes.length,
          sources: pineconeContext.slice(0, 6).map((doc) => ({
            tag: toReadableTag(
              (doc.metadata.namespace as string) || "Doc",
              (doc.metadata.title as string) || (doc.metadata.filename as string) || (doc.metadata.material_name as string) || undefined
            ),
            url: (doc.metadata.url as string) || null,
          })),
        };
        send("context", contextSummary);

        // Build condensed context for model
        const condensedContext = pineconeContext
          .slice(0, 8)
          .map((d) => `${toReadableTag(String(d.metadata.namespace || "Doc"), (d.metadata.title as string) || (d.metadata.filename as string) || (d.metadata.material_name as string) || undefined)}\n${d.text}`)
          .join("\n\n");

        // Generate Win Statements (2-4 items)
        send("progress", { stage: "llm", message: "Generating win statements..." });
        const wsResp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "You are a precise meeting notes parser. From notes and context, propose crisp, actionable Win Statements (the meeting will be considered a success if...). Return as a numbered list of 2-4 items, each <= 180 chars.",
            },
            {
              role: "user",
              content: `Engagement: ${engagement.title || ""}\nTopic: ${engagement.topic || ""}\nCounterparty: ${engagement.org_counterparty || ""}\n\nNOTES:\n${notes}\n\nCONTEXT:\n${condensedContext}`,
            },
          ],
        });
        const wsText = wsResp.choices?.[0]?.message?.content || "";
        const wsItems = wsText
          .split(/\n+/)
          .map((l) => l.replace(/^\s*[-*\d.\)]\s*/, "").trim())
          .filter((l) => l.length > 0)
          .slice(0, 4);
        for (const text of wsItems) {
          send("win_statement", { text });
          await new Promise((r) => setTimeout(r, 40));
        }

        // WIIFT
        send("progress", { stage: "llm", message: "Deriving WIIFT..." });
        const wiiftResp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.2,
          messages: [
            { role: "system", content: "From the notes and context, write one sentence that describes WIIFT (what's in it for them, the counterparty). <= 200 chars." },
            { role: "user", content: `NOTES:\n${notes}\n\nCONTEXT:\n${condensedContext}` },
          ],
        });
        const wiift = (wiiftResp.choices?.[0]?.message?.content || "").trim();
        if (wiift) send("wiift", { text: wiift });

        // WIIFM
        send("progress", { stage: "llm", message: "Deriving WIIFM..." });
        const wiifmResp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.2,
          messages: [
            { role: "system", content: "From the notes and context, write one sentence for WIIFM (what's in it for us, the company). <= 200 chars." },
            { role: "user", content: `NOTES:\n${notes}\n\nCONTEXT:\n${condensedContext}` },
          ],
        });
        const wiifm = (wiifmResp.choices?.[0]?.message?.content || "").trim();
        if (wiifm) send("wiifm", { text: wiifm });

        // ISP summary (split into chunks)
        send("progress", { stage: "llm", message: "Summarizing notes..." });
        const ispResp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "Produce a Full Briefing Report in Markdown strictly from NOTES and CONTEXT. Output exactly these sections and headers, in this order, and nothing else:\n# Title\n## Executive Summary\n## Objectives\n## Win Statements\n## What's in it for them (WIIFT)\n## What's in it for us (WIIFM)\n## Counterparty Profile\n## Materials Intelligence\n## Supply Chain Map\n## Chokepoints & Vulnerabilities\n## Export Controls & Sanctions\n## Market & Recent News\n## Opportunities & Risks\n## End Uses\n## Open Questions / Unknowns\n## Recommended Next Steps\n## References\nRules: No speculation. Use only information supported by NOTES or CONTEXT. Bullets must be concise (<= 160 chars). Omit items not supported by CONTEXT.\nFormatting details:\n- Executive Summary: 5–8 bullets.\n- Objectives: 3–6 bullets (action/outcome phrasing).\n- Win Statements: 2–4 bullets; each <= 180 chars; phrased as 'Success if ...'.\n- What's in it for them (WIIFT): one sentence (<= 200 chars).\n- What's in it for us (WIIFM): one sentence (<= 200 chars).\n- Counterparty Profile: company basics; key stakeholders.\n- Materials Intelligence: materials, key properties, applications (bullets).\n- Supply Chain Map: mines, processing facilities, trade/transport routes (bullets).\n- Chokepoints & Vulnerabilities: bullets.\n- Export Controls & Sanctions: jurisdiction, regulation, 1–2 line summary per item.\n- Market & Recent News: if present in CONTEXT, format as 'YYYY-MM-DD — title — [source-tag]'. Do not invent links.\n- Opportunities & Risks: pair bullets; each risk includes 'Mitigation: ...'.\n- End Uses: bullets.\n- Open Questions / Unknowns: bullets for gaps or missing data.\n- Recommended Next Steps: 3–6 numbered items; each includes 'Owner:', 'Action:', and 'Due window:'.\n- References: list source tags from CONTEXT only (e.g., [documents: ...], [materials: ...]).",
            },
            { role: "user", content: `Engagement: ${engagement.title || ""}\nTopic: ${engagement.topic || ""}\n\nNOTES:\n${notes}\n\nCONTEXT:\n${condensedContext}` },
          ],
        });
        const isp = (ispResp.choices?.[0]?.message?.content || "").trim();
        const chunks: string[] = [];
        const maxChunk = 420;
        for (let i = 0; i < isp.length; i += maxChunk) {
          chunks.push(isp.slice(i, i + maxChunk));
        }
        for (const c of chunks) {
          send("isp_chunk", { text: c });
          await new Promise((r) => setTimeout(r, 30));
        }

        send("done", { ok: true });
        controller.close();
      } catch (err) {
        console.error("Notes parse SSE error:", err);
        send("error", { message: "Failed to parse notes" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
