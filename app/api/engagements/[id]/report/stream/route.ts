import { createClient } from "@/lib/supabase/server";
import OpenAI from "openai";

// GET /api/engagements/:id/report/stream — SSE: regenerate Full Briefing Report from saved data and persist to engagements.isp_md
export async function GET(
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

  // Load engagement and current notes
  const { data: engagement, error: eErr } = await supabase
    .from("engagements")
    .select("id,title,topic,notes,objectives,org_counterparty,meeting_datetime,duration_minutes,location")
    .eq("id", id)
    .single();
  if (eErr || !engagement) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Participants for Meeting Overview and Counterparty context
  const { data: participants } = await supabase
    .from("engagement_participants")
    .select("name,role_title,organization,is_internal")
    .eq("engagement_id", id);

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

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: string, payload: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\n` + `data: ${JSON.stringify(payload)}\n\n`)
        );
      };

      try {
        const debug = process.env.NODE_ENV !== "production";
        if (debug) console.log(`[report/stream] start engagement=${id}`);
        // Context gathering
        send("progress", { message: "Gathering material data..." });
        const notes = (engagement.notes || "").trim();
        const queryText = [engagement.title, engagement.topic, notes]
          .filter(Boolean)
          .join("\n\n");
        if (debug) console.log("[report/stream] queryText snippet=", queryText.slice(0, 400));
        const pineconeContext = await Promise.all([
          searchPineconeNamespace(queryText, "documents"),
          searchPineconeNamespace(queryText, "materials"),
          searchPineconeNamespace(queryText, "ellen-frameworks"),
          searchPineconeNamespace(queryText, "companies"),
          searchPineconeNamespace(queryText, "material_relationships"),
          searchPineconeNamespace(queryText, "end_uses"),
          searchPineconeNamespace(queryText, "processing_facilities"),
        ]).then((chunks) => chunks.flat().sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 12));
        if (debug)
          console.log(
            "[report/stream] pinecone hits=",
            pineconeContext.length,
            "namespaces=",
            pineconeContext.map((d) => d.metadata.namespace).slice(0, 20)
          );
        const condensedContext = pineconeContext
          .slice(0, 8)
          .map((d) => `${toReadableTag(String(d.metadata.namespace || "Doc"), (d.metadata.title as string) || (d.metadata.filename as string) || (d.metadata.material_name as string) || undefined)}\n${d.text}`)
          .join("\n\n");
        if (debug) console.log("[report/stream] condensedContext chars=", condensedContext.length);

        // We can optionally hint the steps
        send("progress", { message: "Crafting win statements..." });
        send("progress", { message: "Determining what's in it for everyone..." });
        send("progress", { message: "Assembling full report..." });

        const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
        const ispResp = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content:
                "# Meeting Intelligence Report\n\nGenerate a focused meeting preparation report from NOTES and CONTEXT. Output exactly these sections and headers, in this order:\n\n## Meeting Overview\n## Win Statements  \n## What's in it for them (WIIFT)\n## What's in it for us (WIIFM)\n## Counterparty Intelligence\n## Material Context\n## Market Dynamics\n## Conversation Strategy\n## Decision Levers\n## Risks & Mitigation\n## Next Steps\n## Intelligence Sources\n\n### Rules:\n* No speculation beyond NOTES and CONTEXT\n* Bullets must be actionable and concise (<= 160 chars)\n* Focus on meeting-relevant intelligence only\n* Omit sections not supported by available data\n\n### Formatting Requirements:\n* Use **bold** for section headers (##)\n* Each bullet point on its own line with proper spacing\n* Use bullet points (•) not asterisks (*)\n* Bold key terms within bullets where relevant\n* Add blank line between sections\n* Use consistent indentation\n\n### Section Guidelines:\n\n**Meeting Overview:** Meeting purpose, participants, timing, and strategic context (3-5 bullets)\n* Format: • **Purpose:** [description]\n* Include: • **Participants:** [names and titles]\n* Include: • **Timing:** [date/time]\n* Include: • **Strategic Context:** [why this meeting matters now]\n\n**Win Statements:** 3-4 bullets phrased as \"Success if...\" (each <= 180 chars)\n* Format: • **Success if** [specific measurable outcome]\n* Include both relationship and business objectives\n* Bold key metrics or commitments\n\n**What's in it for them (WIIFT):** Single sentence capturing their primary motivation/benefit (<= 200 chars)\n* Format as complete sentence, no bullet\n* Bold the key benefit/value proposition\n\n**What's in it for us (WIIFM):** Single sentence capturing our primary objective/value (<= 200 chars)\n* Format as complete sentence, no bullet\n* Bold the key objective or success metric\n\n**Counterparty Intelligence:** Key facts about who we're meeting\n* Format: • **Company:** [name, location, revenue/size]\n* Include: • **Strategic Importance:** [high/medium/low with rationale]\n* Include: • **Decision Authority:** [who has power, influence levels]\n* Include: • **Recent Context:** [relevant activities or changes]\n\n**Material Context:** If materials are relevant to the meeting\n* Format: • **Materials in Scope:** [list with scores]\n* Include: • **Opportunity Assessment:** [investment/security/brokerage scores]\n* Include: • **Supply Chain Status:** [current risks/advantages]\n* Include: • **Strategic Value:** [why these materials matter]\n\n**Market Dynamics:** Current environment affecting the conversation\n* Format: • **Recent Developments:** [market-moving events]\n* Include: • **Regulatory Environment:** [policy impacts]\n* Include: • **Competitive Landscape:** [key players, positioning]\n* Include: • **Price/Supply Trends:** [current market conditions]\n\n**Conversation Strategy:** Tactical meeting guidance\n* Format: • **Key Messages:** [2-3 core points to emphasize]\n* Include: • **Likely Objections:** [anticipated pushback]\n* Include: • **Intelligence to Gather:** [questions to ask]\n* Include: • **Avoid:** [topics to steer clear of]\n\n**Decision Levers:** What actually drives their choices\n* Format: • **Financial:** [cost considerations, ROI requirements]\n* Include: • **Strategic:** [business priorities, pressures]\n* Include: • **Operational:** [practical constraints, capabilities]\n* Include: • **Relationship:** [trust factors, reputation concerns]\n\n**Risks & Mitigation:** Meeting-specific risks (3-5 paired items)\n* Format: • **Risk:** [concern]. **Mitigation:** [specific action]\n* Bold both \"Risk:\" and \"Mitigation:\" labels\n* Focus on actionable mitigation strategies\n\n**Next Steps:** Concrete actions post-meeting (3-5 numbered items)\n* Format: 1. **Owner:** [name] **|** **Action:** [specific task] **|** **Timeline:** [date/timeframe]\n* Use numbered list, not bullets\n* Bold all labels (Owner, Action, Timeline)\n\n**Intelligence Sources:** Reference tags from CONTEXT only\n* Format: • [database: table_name], [documents: filename], [alerts: date-range]\n* Include confidence levels in brackets where available\n* Bold source type labels",
            },
            {
              role: "user",
              content: `Engagement: ${engagement.title || ""}\nTopic: ${engagement.topic || ""}\nCounterparty: ${engagement.org_counterparty || ""}\nWhen: ${engagement.meeting_datetime ? new Date(engagement.meeting_datetime).toISOString() : "TBD"}\nDuration: ${typeof engagement.duration_minutes === "number" ? engagement.duration_minutes + " min" : "TBD"}\nLocation: ${engagement.location || "TBD"}\nParticipants:${(participants || [])
                .map((p) => `\n- ${p.name}${p.role_title ? `, ${p.role_title}` : ""}${p.organization ? ` @ ${p.organization}` : ""}${p.is_internal ? " (internal)" : ""}`)
                .join("")}\n\nNOTES:\n${notes}\n\nCONTEXT:\n${condensedContext}`,
            },
          ],
        });

        const isp = (ispResp.choices?.[0]?.message?.content || "").trim();
        if (debug) {
          console.log("[report/stream] openai resp len=", isp.length, "sample=", isp.slice(0, 1200));
          const flags = {
            hasMeetingOverview: isp.includes("## Meeting Overview"),
            hasMaterialContext: isp.includes("## Material Context"),
            hasMarketDynamics: isp.includes("## Market Dynamics"),
            hasConversationStrategy: isp.includes("## Conversation Strategy"),
          };
          console.log("[report/stream] sections:", flags);
        }
        // Chunk and stream out
        const maxChunk = 420;
        for (let i = 0; i < isp.length; i += maxChunk) {
          const chunk = isp.slice(i, i + maxChunk);
          send("isp_chunk", { text: chunk });
          await new Promise((r) => setTimeout(r, 20));
        }

        send("progress", { message: "Saving report (this might take a few minutes)..." });
        const { error: upErr } = await supabase
          .from("engagements")
          .update({ isp_md: isp })
          .eq("id", id);
        if (upErr) throw upErr;
        if (debug) console.log(`[report/stream] save ok engagement=${id}`);

        // Final visible completion message before closing
        send("progress", { message: "Report saved. Refreshing…" });
        send("done", { ok: true });
        if (debug) console.log(`[report/stream] done engagement=${id}`);
        controller.close();
      } catch (err) {
        if (process.env.NODE_ENV !== "production") console.error("[report/stream] error:", err);
        // send an error event then close
        const encoder = new TextEncoder();
        const payload = `event: error\n` + `data: {"message":"Failed to regenerate report"}\n\n`;
        controller.enqueue(encoder.encode(payload));
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
