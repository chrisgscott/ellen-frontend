export type RiskMit = { risk: string; mitigation: string };
export type NextStep = { owner: string; action: string; timeline: string };

export interface MeetingIntelligenceReport {
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
