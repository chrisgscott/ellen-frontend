import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/engagements/:id/export?format=docx
export async function POST(
  req: Request,
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

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") || "docx").toLowerCase();
  if (format !== "docx") {
    return NextResponse.json({ error: "Only docx supported currently" }, { status: 400 });
  }

  // Ensure access to parent engagement via RLS
  const { data: engagement, error: eErr } = await supabase
    .from("engagements")
    .select("id,title,meeting_datetime,org_counterparty,location,topic,objectives,notes")
    .eq("id", id)
    .single();
  if (eErr || !engagement) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Load related data
  const [{ data: participants }, { data: wins }, { data: agenda }, { data: sp }] = await Promise.all([
    supabase
      .from("engagement_participants")
      .select("name,role_title,organization,email,is_internal,notes")
      .eq("engagement_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("engagement_win_statements")
      .select("win_if,wiift,wiifm")
      .eq("engagement_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("engagement_agenda_items")
      .select("title,detail,order_index,duration_minutes")
      .eq("engagement_id", id)
      .order("order_index", { ascending: true })
      .order("created_at", { ascending: true }),
    supabase
      .from("engagement_support_packages")
      .select("summary_md,generated_at")
      .eq("engagement_id", id)
      .order("generated_at", { ascending: false })
      .limit(1),
  ]);

  // Dynamic import docx to avoid hard dependency
  let docx: typeof import("docx");
  try {
    docx = await import("docx");
  } catch {
    return NextResponse.json(
      {
        error: "DOCX export requires 'docx' package.",
        install: "cd ellen-dashboard && npm i docx",
      },
      { status: 501 }
    );
  }

  const {
    Document,
    Packer,
    Paragraph,
    HeadingLevel,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
  } = docx;

  const title = new Paragraph({
    text: engagement.title ?? "Engagement",
    heading: HeadingLevel.TITLE,
  });

  const meta: string[] = [];
  if (engagement.meeting_datetime) meta.push(`When: ${new Date(engagement.meeting_datetime).toLocaleString()}`);
  if (engagement.location) meta.push(`Where: ${engagement.location}`);
  if (engagement.org_counterparty) meta.push(`Counterparty: ${engagement.org_counterparty}`);
  if (engagement.topic) meta.push(`Topic: ${engagement.topic}`);

  const metaPara = new Paragraph(meta.join(" | "));

  const objectivesPara = new Paragraph({
    children: [
      new TextRun({ text: "Objectives: ", bold: true }),
      new TextRun(String((engagement.objectives ?? []).join("; ") || "—")),
    ],
  });

  // Participants table
  const participantRows = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph("Name")]}),
        new TableCell({ children: [new Paragraph("Role/Title")]}),
        new TableCell({ children: [new Paragraph("Org")]}),
        new TableCell({ children: [new Paragraph("Internal?")]}),
      ],
    }),
    ...((participants ?? []).map((p) =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(p.name ?? "")] }),
          new TableCell({ children: [new Paragraph(p.role_title ?? "")] }),
          new TableCell({ children: [new Paragraph(p.organization ?? "")] }),
          new TableCell({ children: [new Paragraph(p.is_internal ? "Yes" : "No")] }),
        ],
      })
    )),
  ];

  const participantsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: participantRows,
  });

  // Win statements section
  const winHeading = new Paragraph({ text: "Win Statements", heading: HeadingLevel.HEADING_2 });
  const winParas = (wins ?? []).flatMap((w, i) => [
    new Paragraph({ text: `Win #${i + 1}`, heading: HeadingLevel.HEADING_3 }),
    new Paragraph({ children: [new TextRun({ text: "Win-If: ", bold: true }), new TextRun(w.win_if ?? "—")] }),
    new Paragraph({ children: [new TextRun({ text: "WIIFT: ", bold: true }), new TextRun(w.wiift ?? "—")] }),
    new Paragraph({ children: [new TextRun({ text: "WIIFM: ", bold: true }), new TextRun(w.wiifm ?? "—")] }),
  ]);

  // Agenda section
  const agendaHeading = new Paragraph({ text: "Agenda", heading: HeadingLevel.HEADING_2 });
  const agendaRows = [
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph("#")] }),
        new TableCell({ children: [new Paragraph("Title")] }),
        new TableCell({ children: [new Paragraph("Detail")] }),
        new TableCell({ children: [new Paragraph("Duration (min)")] }),
      ],
    }),
    ...((agenda ?? []).map((a, idx) =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(String(a.order_index ?? idx + 1))] }),
          new TableCell({ children: [new Paragraph(a.title ?? "")] }),
          new TableCell({ children: [new Paragraph(a.detail ?? "")] }),
          new TableCell({ children: [new Paragraph(a.duration_minutes != null ? String(a.duration_minutes) : "")] }),
        ],
      })
    )),
  ];
  const agendaTable = new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: agendaRows });

  // Support package summary if exists
  const spHeading = new Paragraph({ text: "Support Package Summary", heading: HeadingLevel.HEADING_2 });
  const spPara = new Paragraph((sp && sp[0]?.summary_md) ? sp[0].summary_md : "—");

  const doc = new Document({
    sections: [
      {
        children: [
          title,
          metaPara,
          objectivesPara,
          new Paragraph(" "),
          new Paragraph({ text: "Participants", heading: HeadingLevel.HEADING_2 }),
          participantsTable,
          new Paragraph(" "),
          winHeading,
          ...winParas,
          new Paragraph(" "),
          agendaHeading,
          agendaTable,
          new Paragraph(" "),
          spHeading,
          spPara,
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const filename = `${(engagement.title || "engagement").replace(/[^a-z0-9-_]+/gi, "-")}.docx`;
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(buffer.byteLength),
    },
  });
}
