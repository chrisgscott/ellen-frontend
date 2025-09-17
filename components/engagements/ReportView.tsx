"use client";
import React from "react";
import { MeetingIntelligenceReport, NextStep, RiskMit } from "@/lib/types/meeting-report";

export function ReportView({ report, className }: { report: MeetingIntelligenceReport; className?: string }) {
  return (
    <div className={className}>
      <Section title="Meeting Overview">
        <Bullets items={report.meetingOverview} />
      </Section>

      <Section title="Win Statements">
        <Bullets items={report.winStatements} />
      </Section>

      <Section title="What's in it for them (WIIFT)">
        <p className="text-sm whitespace-pre-wrap">{report.wiift || "—"}</p>
      </Section>

      <Section title="What's in it for us (WIIFM)">
        <p className="text-sm whitespace-pre-wrap">{report.wiifm || "—"}</p>
      </Section>

      <Section title="Counterparty Intelligence">
        <Bullets items={report.counterpartyIntelligence} />
      </Section>

      {(report.materialContext?.length ?? 0) > 0 && (
        <Section title="Material Context">
          <Bullets items={report.materialContext!} />
        </Section>
      )}

      {(report.marketDynamics?.length ?? 0) > 0 && (
        <Section title="Market Dynamics">
          <Bullets items={report.marketDynamics!} />
        </Section>
      )}

      <Section title="Conversation Strategy">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Subsection title="Key Messages"><Bullets items={report.conversationStrategy.keyMessages} /></Subsection>
          <Subsection title="Likely Objections"><Bullets items={report.conversationStrategy.likelyObjections} /></Subsection>
          <Subsection title="Intelligence To Gather"><Bullets items={report.conversationStrategy.intelligenceToGather} /></Subsection>
          <Subsection title="Avoid"><Bullets items={report.conversationStrategy.avoid} /></Subsection>
        </div>
      </Section>

      <Section title="Decision Levers">
        <div className="flex flex-wrap gap-2 text-xs">
          {report.decisionLevers.financial.map((x, i) => (
            <Badge key={`fin-${i}`}>{x}</Badge>
          ))}
          {report.decisionLevers.strategic.map((x, i) => (
            <Badge key={`str-${i}`}>{x}</Badge>
          ))}
          {report.decisionLevers.operational.map((x, i) => (
            <Badge key={`ops-${i}`}>{x}</Badge>
          ))}
          {report.decisionLevers.relationship.map((x, i) => (
            <Badge key={`rel-${i}`}>{x}</Badge>
          ))}
        </div>
      </Section>

      <Section title="Risks & Mitigation">
        <ul className="list-none space-y-1">
          {report.risksAndMitigation.map((rm: RiskMit, i: number) => (
            <li key={i} className="text-sm">
              <strong>Risk:</strong> {rm.risk || "—"} <span className="mx-1">•</span> <strong>Mitigation:</strong> {rm.mitigation || "—"}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Next Steps">
        <ol className="list-decimal pl-5 space-y-1 text-sm">
          {report.nextSteps.map((ns: NextStep, i: number) => (
            <li key={i}>
              <span className="font-medium">Owner:</span> {ns.owner || "—"} <span className="mx-1">|</span>
              <span className="font-medium">Action:</span> {ns.action || "—"} <span className="mx-1">|</span>
              <span className="font-medium">Timeline:</span> {ns.timeline || "—"}
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Intelligence Sources">
        <Bullets items={report.intelligenceSources} />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details open className="mb-4">
      <summary className="cursor-pointer select-none text-base font-semibold mb-2">{title}</summary>
      <div className="pl-1">{children}</div>
    </details>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-sm font-semibold mb-1">{title}</div>
      {children}
    </div>
  );
}

function Bullets({ items }: { items: string[] }) {
  if (!items || items.length === 0) return <div className="text-sm text-muted-foreground">—</div>;
  return (
    <ul className="list-disc pl-5 space-y-1 text-sm">
      {items.map((b, i) => (
        <li key={i}>{b}</li>
      ))}
    </ul>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block border rounded px-2 py-0.5 bg-muted text-xs">
      {children}
    </span>
  );
}
