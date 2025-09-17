import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";
import { z } from "zod";

// Pinecone metadata typing to avoid unsafe `any` casts
type PineconeMetadata = {
  namespace?: string;
  title?: string;
  filename?: string;
  material_name?: string;
  detectedMaterials?: string[] | string;
  detected_materials?: string[] | string;
  geographic_focus?: string | string[];
  documentType?: string;
  enhanced_doc_type?: string;
};

const asMeta = (m: unknown): PineconeMetadata => (m ?? {}) as PineconeMetadata;

// POST /api/engagements/:id/report — Regenerate the full Engagement Report and persist to engagements.isp_md
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const supabase = await createClient();
  const isDev = process.env.NODE_ENV !== "production";

  const { data: auth, error: userErr } = await supabase.auth.getUser();
  if (userErr || !auth?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Zod schema for strict validation and normalization
  const zStrArray = z.array(z.string()).catch([]);
  const zRiskMit = z
    .object({ risk: z.string().catch(""), mitigation: z.string().catch("") })
    .catch({ risk: "", mitigation: "" });
  const zNextStep = z
    .object({ owner: z.string().catch(""), action: z.string().catch(""), timeline: z.string().catch("") })
    .catch({ owner: "", action: "", timeline: "" });

  const ReportSchema = z.object({
    meetingOverview: zStrArray,
    winStatements: zStrArray,
    wiift: z.string().catch(""),
    wiifm: z.string().catch(""),
    counterpartyIntelligence: zStrArray,
    materialContext: zStrArray.optional().catch([]),
    marketDynamics: zStrArray.optional().catch([]),
    conversationStrategy: z
      .object({
        keyMessages: zStrArray,
        likelyObjections: zStrArray,
        intelligenceToGather: zStrArray,
        avoid: zStrArray,
      })
      .catch({ keyMessages: [], likelyObjections: [], intelligenceToGather: [], avoid: [] }),
    decisionLevers: z
      .object({
        financial: zStrArray,
        strategic: zStrArray,
        operational: zStrArray,
        relationship: zStrArray,
      })
      .catch({ financial: [], strategic: [], operational: [], relationship: [] }),
    risksAndMitigation: z.array(zRiskMit).catch([]),
    nextSteps: z.array(zNextStep).catch([]),
    intelligenceSources: zStrArray,
  });

  // Load engagement and current notes
  const { data: engagement, error: eErr } = await supabase
    .from("engagements")
    .select(
      "id,title,topic,notes,objectives,org_counterparty,meeting_datetime,duration_minutes,location"
    )
    .eq("id", id)
    .single();
  if (eErr || !engagement) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Load participants for richer Meeting Overview/Counterparty context
  const { data: participants } = await supabase
    .from("engagement_participants")
    .select("name,role_title,organization,is_internal")
    .eq("engagement_id", id);

  // Build Pinecone context (match the parse route behavior)
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
            query: { inputs: { text: query }, top_k: 5 },
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
    const flat = results.flat().sort((a, b) => (b.score || 0) - (a.score || 0));
    const byNs = (ns: PineconeNamespace) => flat.filter((d) => d.metadata.namespace === ns);
    const picks: PineconeDocument[] = [];
    // Ensure coverage from key namespaces
    picks.push(...byNs("materials").slice(0, 3));
    picks.push(...byNs("documents").slice(0, 3));
    // Fill remaining with highest scores not already selected
    const selectedIds = new Set(picks.map((p) => p.id));
    for (const d of flat) {
      if (picks.length >= 12) break;
      if (!selectedIds.has(d.id)) picks.push(d);
    }
    return picks.slice(0, 12);
  };

  // RSS RPC result typing
  type RssRow = {
    id: number;
    title: string | null;
    source: string | null;
    created_at: string | null;
    link: string | null;
    snippet: string | null;
    distance: number | null;
  };

  const notes = (engagement.notes || "").trim();
  const objectivesStr = Array.isArray(engagement.objectives) ? (engagement.objectives as string[]).join(", ") : "";
  const queryText = [
    engagement.title,
    engagement.topic,
    engagement.org_counterparty,
    objectivesStr,
    notes,
  ]
    .filter(Boolean)
    .join("\n\n");
  if (isDev) console.log("[report/json] queryText snippet=", queryText.slice(0, 400));
  const pineconeContext = await searchMultipleNamespaces(queryText);
  if (isDev)
    console.log(
      "[report/json] pinecone hits=", pineconeContext.length,
      "namespaces=",
      pineconeContext.map((d) => d.metadata.namespace).slice(0, 20)
    );

  // Supabase RSS retrieval via pgvector RPC
  // 1) Create an embedding for the query text
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const embIn = queryText.slice(0, 8000);
  const embResp = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: embIn,
  });
  const queryEmbedding = embResp.data?.[0]?.embedding || [];
  // 2) Call RPC for top recent RSS items
  const { data: rssRowsRaw, error: rssErr } = await supabase.rpc('rss_search_feed_level', {
    p_query_embedding: queryEmbedding as unknown as number[],
    p_since: new Date(Date.now() - 1000 * 60 * 60 * 24 * 45).toISOString(),
    p_limit: 6,
    p_primary_material: null,
    p_categories: null,
  });
  const rssRows = (rssRowsRaw ?? []) as RssRow[];
  if (rssErr && isDev) console.error("[report/json] rss rpc error=", rssErr.message || rssErr);
  if (isDev) console.log("[report/json] rss matches=", (rssRows || []).length, rssRows?.slice(0, 3)?.map((r: RssRow) => r.title));

  const condensedContext = pineconeContext
    .slice(0, 10)
    .map(
      (d) =>
        `${toReadableTag(String(d.metadata.namespace || "Doc"), (d.metadata.title as string) || (d.metadata.filename as string) || (d.metadata.material_name as string) || undefined)}\n${d.text}`
    )
    .join("\n\n");

  // Build a concise context summary from metadata to steer the model toward materials & market sections
  const summarizeVal = (v: unknown): string => {
    if (Array.isArray(v)) return v.filter(Boolean).map(String).join(", ");
    if (v == null) return "-";
    return String(v);
  };
  const materialSummaries = pineconeContext
    .filter((d) => d.metadata.namespace === "materials")
    .slice(0, 5)
    .map((d) => {
      const md = asMeta(d.metadata);
      const title = (md.title as string) || (md.filename as string) || (md.material_name as string) || "untitled";
      const mats = summarizeVal(md.detectedMaterials || md.detected_materials || md.material_name);
      const region = summarizeVal(md.geographic_focus);
      return `- [materials] ${title} | materials: ${mats} | region: ${region}`;
    });
  const documentSummaries = pineconeContext
    .filter((d) => d.metadata.namespace === "documents")
    .slice(0, 5)
    .map((d) => {
      const md = asMeta(d.metadata);
      const title = (md.title as string) || (md.filename as string) || "untitled";
      const dtype = summarizeVal(md.documentType || md.enhanced_doc_type);
      const region = summarizeVal(md.geographic_focus);
      return `- [documents] ${title} | type: ${dtype} | region: ${region}`;
    });
  const contextSummary = [
    "CONTEXT SUMMARY:",
    ...(materialSummaries.length ? ["Materials:", ...materialSummaries] : []),
    ...(documentSummaries.length ? ["Documents:", ...documentSummaries] : []),
  ].join("\n");

  // Build RSS SUMMARY block
  const rssSummary = (() => {
    const rows: RssRow[] = Array.isArray(rssRows) ? rssRows : [];
    if (!rows.length) return "";
    const fmt = rows.map((r: RssRow) => {
      const d = r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : "";
      const src = r.source ? ` (${r.source})` : "";
      const snip = (r.snippet || "").toString().trim();
      const short = snip.length > 180 ? snip.slice(0, 177) + "…" : snip;
      return `- ${r.title || "Untitled"}${src}${d ? ` — ${d}` : ""}${short ? `\n  ${short}` : ""}`;
    });
    return ["RSS SUMMARY:", ...fmt].join("\n");
  })();

  // Generate structured JSON Meeting Intelligence Report
  const userContext = `Engagement: ${engagement.title || ""}
Topic: ${engagement.topic || ""}
Counterparty: ${engagement.org_counterparty || ""}
When: ${engagement.meeting_datetime ? new Date(engagement.meeting_datetime).toISOString() : "TBD"}
Duration: ${typeof engagement.duration_minutes === "number" ? engagement.duration_minutes + " min" : "TBD"}
Location: ${engagement.location || "TBD"}
Participants:${(participants || [])
    .map(
      (p) => `
- ${p.name}${p.role_title ? `, ${p.role_title}` : ""}${p.organization ? ` @ ${p.organization}` : ""}${p.is_internal ? " (internal)" : ""}`
    )
    .join("")}

NOTES:
${notes}

${rssSummary}

${contextSummary}

CONTEXT:
${condensedContext}`;

  const systemJSON = `You are a meeting intelligence assistant. Return ONLY valid JSON that matches this TypeScript type, no prose:
type MeetingIntelligenceReport = {
  meetingOverview: string[];
  winStatements: string[];
  wiift: string;
  wiifm: string;
  counterpartyIntelligence: string[];
  materialContext?: string[];
  marketDynamics?: string[];
  conversationStrategy: { keyMessages: string[]; likelyObjections: string[]; intelligenceToGather: string[]; avoid: string[] };
  decisionLevers: { financial: string[]; strategic: string[]; operational: string[]; relationship: string[] };
  risksAndMitigation: { risk: string; mitigation: string }[];
  nextSteps: { owner: string; action: string; timeline: string }[];
  intelligenceSources: string[];
};

Rules:
- No speculation beyond NOTES and CONTEXT.
- Bullets must be actionable and concise (<= 160 chars).
- Omit sections not supported by available data (use empty arrays where appropriate).
- If uncertain, return empty arrays/strings rather than inventing content.
- Use CONTEXT SUMMARY to prioritize populating materialContext and marketDynamics when relevant signals exist (materials detected, regions, document types).`;

  async function callJSONOnce() {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemJSON },
        { role: "user", content: userContext },
      ],
    });
    const out = (resp.choices?.[0]?.message?.content || "").trim();
    if (isDev) console.log("[report/json] openai resp len=", out.length, "sample=", out.slice(0, 1200));
    return out;
  }

  type RiskMit = { risk: string; mitigation: string };
  type NextStep = { owner: string; action: string; timeline: string };
  interface MeetingIntelligenceReport {
    meetingOverview: string[];
    winStatements: string[];
    wiift: string;
    wiifm: string;
    counterpartyIntelligence: string[];
    materialContext?: string[];
    marketDynamics?: string[];
    conversationStrategy: {
      keyMessages: string[];
      likelyObjections: string[];
      intelligenceToGather: string[];
      avoid: string[];
    };
    decisionLevers: {
      financial: string[];
      strategic: string[];
      operational: string[];
      relationship: string[];
    };
    risksAndMitigation: RiskMit[];
    nextSteps: NextStep[];
    intelligenceSources: string[];
  }

  let jsonText = await callJSONOnce();
  let report: MeetingIntelligenceReport | null = null;
  const parseWithZod = (s: string): MeetingIntelligenceReport | null => {
    try {
      const raw = JSON.parse(s);
      const parsed = ReportSchema.safeParse(raw);
      if (!parsed.success) {
        if (isDev) console.log("[report/json] zod parse failed:", parsed.error);
        return null;
      }
      return parsed.data as MeetingIntelligenceReport;
    } catch {
      if (isDev) console.log("[report/json] JSON.parse failed");
      return null;
    }
  };
  report = parseWithZod(jsonText);
  if (!report || typeof report !== "object") {
    // Retry with stricter instruction
    const strictSystem = systemJSON + "\nReturn ONLY a single JSON object. Do not include markdown, code fences, or explanations.";
    const resp2 = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: strictSystem },
        { role: "user", content: userContext },
      ],
    });
    jsonText = (resp2.choices?.[0]?.message?.content || "").trim();
    if (isDev) console.log("[report/json] retry resp len=", jsonText.length, "sample=", jsonText.slice(0, 1200));
    report = parseWithZod(jsonText);
  }

  if (!report || typeof report !== "object") {
    return new Response(JSON.stringify({ error: "Model did not return valid JSON" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Zod has normalized/filled defaults; proceed to render Markdown

  // Render Markdown from JSON for compatibility
  const md = [
    "## Meeting Overview",
    ...report.meetingOverview.map((b: string) => `• ${b}`),
    "",
    "## Win Statements",
    ...report.winStatements.map((b: string) => `• ${b}`),
    "",
    "## What's in it for them (WIIFT)",
    report.wiift,
    "",
    "## What's in it for us (WIIFM)",
    report.wiifm,
    "",
    "## Counterparty Intelligence",
    ...report.counterpartyIntelligence.map((b: string) => `• ${b}`),
    "",
    ...(report.materialContext?.length ? ["## Material Context", ...report.materialContext.map((b: string) => `• ${b}`), ""] : []),
    ...(report.marketDynamics?.length ? ["## Market Dynamics", ...report.marketDynamics.map((b: string) => `• ${b}`), ""] : []),
    "## Conversation Strategy",
    ...report.conversationStrategy.keyMessages.map((b: string) => `• ${b}`),
    ...report.conversationStrategy.likelyObjections.map((b: string) => `• ${b}`),
    ...report.conversationStrategy.intelligenceToGather.map((b: string) => `• ${b}`),
    ...report.conversationStrategy.avoid.map((b: string) => `• ${b}`),
    "",
    "## Decision Levers",
    ...report.decisionLevers.financial.map((b: string) => `• ${b}`),
    ...report.decisionLevers.strategic.map((b: string) => `• ${b}`),
    ...report.decisionLevers.operational.map((b: string) => `• ${b}`),
    ...report.decisionLevers.relationship.map((b: string) => `• ${b}`),
    "",
    "## Risks & Mitigation",
    ...report.risksAndMitigation.map((x: RiskMit) => `• Risk: ${x.risk}. Mitigation: ${x.mitigation}`),
    "",
    "## Next Steps",
    ...report.nextSteps.map((x: NextStep, i: number) => `${i + 1}. Owner: ${x.owner} | Action: ${x.action} | Timeline: ${x.timeline}`),
    "",
    "## Intelligence Sources",
    ...report.intelligenceSources.map((b: string) => `• ${b}`),
  ].join("\n");

  const isp_md = md.trim();

  if (isDev) {
    console.log("[report/json] section sizes:", {
      meetingOverview: report.meetingOverview?.length || 0,
      winStatements: report.winStatements?.length || 0,
      wiift: (report.wiift || "").length,
      wiifm: (report.wiifm || "").length,
      counterpartyIntelligence: report.counterpartyIntelligence?.length || 0,
      materialContext: report.materialContext?.length || 0,
      marketDynamics: report.marketDynamics?.length || 0,
      keyMessages: report.conversationStrategy?.keyMessages?.length || 0,
      likelyObjections: report.conversationStrategy?.likelyObjections?.length || 0,
      intelligenceToGather: report.conversationStrategy?.intelligenceToGather?.length || 0,
      avoid: report.conversationStrategy?.avoid?.length || 0,
      decisionLevers: {
        financial: report.decisionLevers?.financial?.length || 0,
        strategic: report.decisionLevers?.strategic?.length || 0,
        operational: report.decisionLevers?.operational?.length || 0,
        relationship: report.decisionLevers?.relationship?.length || 0,
      },
      risksAndMitigation: report.risksAndMitigation?.length || 0,
      nextSteps: report.nextSteps?.length || 0,
      intelligenceSources: report.intelligenceSources?.length || 0,
      mdChars: isp_md.length,
    });
  }

  // Persist to DB (retry without isp_json if column doesn't exist yet)
  let upErr: unknown = null;
  {
    const { error } = await supabase
      .from("engagements")
      .update({ isp_md, isp_json: report })
      .eq("id", id);
    upErr = error;
  }
  if (upErr) {
    const msg = typeof upErr === "object" && upErr && "message" in upErr ? String((upErr as { message?: unknown }).message) : String(upErr);
    const looksLikeMissingColumn = /isp_json/i.test(msg) && /column/i.test(msg);
    if (looksLikeMissingColumn) {
      const { error: fallbackErr } = await supabase
        .from("engagements")
        .update({ isp_md })
        .eq("id", id);
      if (fallbackErr) {
        return new Response(JSON.stringify({ error: "Failed to update report" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    } else {
      return new Response(JSON.stringify({ error: "Failed to update report" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify({ ok: true, report, isp_md }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
