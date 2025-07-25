import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import {
    Building,
    BarChart3,
    PieChart,
    ShieldCheck,
    Network,
    Lightbulb,
    Users,
    BookCopy,
    Globe,
    User
} from 'lucide-react';
import { AskEllenButton } from '../_components/ask-ellen-button';
import TocSidebar from '../_components/toc-sidebar';

interface PageProps {
  params: {
    material: string;
  };
}

const Section = ({ title, children, icon: Icon, id }: { title: string; children: React.ReactNode; icon?: React.ElementType; id: string }) => (
  <Card id={id} className="mb-8 scroll-mt-24">
    <CardHeader>
      <CardTitle className="flex items-center">
        {Icon && <Icon className="mr-3 h-6 w-6 text-primary" />} {title}
      </CardTitle>
    </CardHeader>
    <CardContent>
      {children}
    </CardContent>
  </Card>
);

const SubSection = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className="mb-8">
    <h3 className="text-xl font-semibold mb-4">{title}</h3>
    <div className="space-y-2">{children}</div>
  </div>
);

const DataPoint = ({ label, value, unit = '' }: { label: string; value: string | number | null; unit?: string }) => (
  <p><span className="font-semibold">{label}:</span> {value ?? 'N/A'}{unit}</p>
);

const MarkdownText = ({ label, content }: { label: string; content: string | null | unknown }) => {
  // Handle null, undefined, or non-string content
  if (!content) {
    return <p><span className="font-semibold">{label}:</span> N/A</p>;
  }

  // Convert content to string if it's not already
  const stringContent = typeof content === 'string' ? content : String(content);
  
  if (stringContent.trim() === '') {
    return <p><span className="font-semibold">{label}:</span> N/A</p>;
  }

  // Extract content from JSON if needed
  let processedContent = stringContent;
  try {
    const parsed = JSON.parse(stringContent);
    if (parsed && typeof parsed === 'object' && parsed.value) {
      processedContent = String(parsed.value);
    }
  } catch {
    // Not JSON, use content as-is
  }

  return (
    <div className="mb-4">
      <p className="font-semibold mb-2">{label}:</p>
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]} 
          components={{ 
            p: ({ ...props}) => <p className="mb-2" {...props} />,
            strong: ({ ...props}) => <strong className="font-semibold text-foreground" {...props} />,
            ul: ({ ...props}) => <ul className="list-disc list-inside space-y-1" {...props} />,
            li: ({ ...props}) => <li {...props} />
          }}
        >
          {processedContent}
        </ReactMarkdown>
      </div>
    </div>
  );
};

const Score = ({ label, value, max = 5 }: { label: string; value: number; max?: number }) => {
  // Determine badge color based on score (green = best, red = worst)
  const getBadgeColor = (score: number, maxScore: number) => {
    if (!score) return 'bg-muted text-muted-foreground';
    // Use exact score values for 5-point scale to ensure distinct colors
    if (maxScore === 5) {
      if (score === 5) return 'bg-red-600/90 text-white'; // Score 5 - Darkest red
      if (score === 4) return 'bg-red-500/90 text-white'; // Score 4 - Red
      if (score === 3) return 'bg-orange-500/90 text-white'; // Score 3 - Orange
      if (score === 2) return 'bg-yellow-500/90 text-white'; // Score 2 - Yellow
      if (score === 1) return 'bg-lime-400/90 text-black'; // Score 1 - Light green
    }
    // Fallback to normalized ranges for other scales
    const normalized = score / maxScore;
    if (normalized >= 0.8) return 'bg-red-500/90 text-white';
    if (normalized >= 0.6) return 'bg-orange-500/90 text-white';
    if (normalized >= 0.4) return 'bg-yellow-500/90 text-white';
    if (normalized >= 0.2) return 'bg-lime-400/90 text-black';
    return 'bg-green-500/90 text-white';
  };

  return (
    <div className="flex items-center gap-3">
      <span className="font-semibold">{label}:</span>
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${getBadgeColor(value, max)}`}>
        {value ?? 'N/A'}/{max}
      </span>
    </div>
  );
};

const ScoreCard = ({ label, value, max = 5 }: { label: string; value: number; max?: number }) => {
  // Determine background color based on score (green = best, red = worst)
  const getBackgroundColor = (score: number, maxScore: number) => {
    if (!score) return 'bg-muted/30';
    // Use exact score values for 5-point scale to ensure distinct colors
    if (maxScore === 5) {
      if (score === 5) return 'bg-red-600/20 border-red-300'; // Score 5 - Darkest red
      if (score === 4) return 'bg-red-500/20 border-red-200'; // Score 4 - Red
      if (score === 3) return 'bg-orange-500/20 border-orange-200'; // Score 3 - Orange
      if (score === 2) return 'bg-yellow-500/20 border-yellow-200'; // Score 2 - Yellow
      if (score === 1) return 'bg-lime-400/20 border-lime-300'; // Score 1 - Light green
    }
    // Fallback to normalized ranges for other scales
    const normalized = score / maxScore;
    if (normalized >= 0.8) return 'bg-red-500/20 border-red-200';
    if (normalized >= 0.6) return 'bg-orange-500/20 border-orange-200';
    if (normalized >= 0.4) return 'bg-yellow-500/20 border-yellow-200';
    if (normalized >= 0.2) return 'bg-lime-400/20 border-lime-300';
    return 'bg-green-500/20 border-green-200';
  };

  return (
    <div className={`text-center p-4 rounded-lg border ${getBackgroundColor(value, max)}`}>
      <div className="text-2xl font-bold text-primary">{value || 'N/A'}/{max}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
    </div>
  );
};

const JsonValue = ({ jsonString }: { jsonString: string | null }) => {
  if (!jsonString || jsonString.trim() === '') {
    return <p>N/A</p>;
  }
  
  try {
    const parsed = JSON.parse(jsonString);
    
    // Handle different JSON structures
    if (parsed && typeof parsed === 'object') {
      if (parsed.value !== undefined) {
        return <p>{String(parsed.value)}</p>;
      } else if (Array.isArray(parsed)) {
        return <p>{parsed.join(', ')}</p>;
      } else {
        // Display the first meaningful value from the object
        const values = Object.values(parsed).filter(v => v !== null && v !== undefined);
        return <p>{values.length > 0 ? String(values[0]) : 'N/A'}</p>;
      }
    }
    
    return <p>{String(parsed)}</p>;
  } catch {
    // Not JSON, display as plain text
    return <p>{jsonString}</p>;
  }
};

const StringArrayDisplay = ({ content, displayAs = 'badges' }: { content: string | string[] | null, displayAs?: 'badges' | 'text' }) => {
    let items: string[] = [];

    if (!content) {
        return <p>N/A</p>;
    }

    if (typeof content === 'string') {
        try {
            // Try to parse as JSON first
            const parsed = JSON.parse(content);
            if (Array.isArray(parsed)) {
                // Direct array: ["item1", "item2"]
                items = parsed.map(String).filter(Boolean);
            } else if (parsed && typeof parsed.value === 'string') {
                // Nested value: {"value": "item1, item2"}
                items = parsed.value.split(',').map((item: string) => item.trim()).filter(Boolean);
            } else if (Array.isArray(parsed.value)) {
                // Nested array: {"value": ["item1", "item2"]}
                items = parsed.value.map(String).filter(Boolean);
            } else {
                // Single value object: {"value": "single item"}
                items = [String(parsed.value || parsed)].filter(Boolean);
            }
        } catch {
            // Not JSON, check if it's a comma-separated string
            if (content.includes(',')) {
                items = content.split(',').map((item: string) => item.trim()).filter(Boolean);
            } else {
                items = [content].filter(Boolean);
            }
        }
    } else if (Array.isArray(content)) {
        // Handle arrays that might contain JSON strings or malformed data
        items = content.flatMap(item => {
            if (typeof item === 'string') {
                try {
                    // Try to parse each array item as JSON
                    const parsed = JSON.parse(item);
                    return Array.isArray(parsed) ? parsed : [parsed];
                } catch {
                    // Clean up malformed JSON fragments, numbered lists, and quotes
                    const cleaned = item
                        .replace(/^\d+\.\s*/, '') // Remove numbered lists
                        .replace(/^["{]+|[}"]+$/g, '') // Remove leading/trailing braces and quotes
                        .replace(/^"|"$/g, '') // Remove remaining quotes
                        .trim();
                    
                    // If it contains commas, split it (handles cases like "Shanghai (China), Rotterdam (Netherlands)")
                    if (cleaned.includes(',') && !cleaned.includes('(')) {
                        return cleaned.split(',').map(s => s.trim()).filter(Boolean);
                    }
                    
                    return cleaned;
                }
            }
            return String(item);
        }).filter(Boolean);
    }

    if (items.length === 0) {
        return <p>N/A</p>;
    }

    if (displayAs === 'text') {
        return <>{items.join(', ')}</>;
    }

    return (
        <div className="flex flex-wrap gap-2 mt-2">
            {items.map((item, index) => (
                <Badge key={index}>{item}</Badge>
            ))}
        </div>
    );
};



const reportSections = [
  { id: 'strategic-dashboard', title: 'Strategic Assessment Dashboard', icon: BarChart3 },
  { id: 'market-overview', title: 'Market Overview', icon: Building },
  { id: 'trading-intelligence', title: 'Trading Intelligence', icon: BarChart3 },
  { id: 'investment-analysis', title: 'Investment Analysis', icon: PieChart },
  { id: 'national-security-assessment', title: 'National Security Assessment', icon: ShieldCheck },
  { id: 'supply-chain-intelligence', title: 'Supply Chain Intelligence', icon: Network },
  { id: 'operational-considerations', title: 'Operational Considerations', icon: Building },
  { id: 'strategic-recommendations', title: 'Strategic Recommendations', icon: Lightbulb },
  { id: 'key-stakeholders', title: 'Key Stakeholders', icon: Users },
  { id: 'sources-data-quality', title: 'Sources & Data Quality', icon: BookCopy },
];



export default async function MaterialPage({ params }: PageProps) {
  const { material } = await params;
  const supabase = await createClient();
  const materialName = decodeURIComponent(material);

  const { data: materialData, error } = await supabase
    .from("materials")
    .select(`
      *,
      materials_list_items(
        materials_lists(
          id,
          name,
          is_global
        )
      )
    `)
    .eq("material", materialName)
    .single();

  if (error || !materialData) {
    notFound();
  }

  // Check if material has insufficient data (no summary)
  const hasInsufficientData = !materialData.summary || materialData.summary.trim() === '';

  if (hasInsufficientData) {
    return (
      <div className="flex-1 p-4 lg:p-8">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <h1 className="text-4xl font-bold">{materialData.material}</h1>
          </div>
        </header>
        
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-8 text-center max-w-md">
            <div className="text-yellow-800">
              <h3 className="text-xl font-semibold mb-3">Information Coming Soon</h3>
              <p className="text-sm leading-relaxed">
                We&apos;re currently compiling detailed information for this material. 
                Please check back later or{' '}
                <a 
                  href={`mailto:cscott@tier-tech.com?subject=Please update ${encodeURIComponent(materialData.material)}`}
                  className="text-yellow-700 underline hover:text-yellow-900 font-medium"
                >
                  bug Chris
                </a>{' '}
                to get {materialData.material} information added faster.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 lg:p-8">
        <header className="mb-8">
            <div className="flex items-center justify-between">
                <h1 className="text-4xl font-bold">{materialData.material}</h1>
            </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 pb-8 border-b">
            <div>
                <p className="font-semibold mr-2">Lists:</p>
                <div className="flex flex-wrap gap-2 mt-2">
                    {materialData.materials_list_items && materialData.materials_list_items.length > 0 ? (
                        materialData.materials_list_items.map((item: { materials_lists: { id: string; name: string; is_global: boolean } }) => (
                            <Badge 
                                key={item.materials_lists.id} 
                                variant={item.materials_lists.is_global ? "default" : "secondary"}
                                className={`flex items-center gap-1 ${item.materials_lists.is_global ? "" : "border-dashed"}`}
                            >
                                {item.materials_lists.is_global ? (
                                    <Globe className="h-3 w-3" />
                                ) : (
                                    <User className="h-3 w-3" />
                                )}
                                {item.materials_lists.name}
                            </Badge>
                        ))
                    ) : (
                        <p className="text-muted-foreground">Not in any lists</p>
                    )}
                </div>
                {materialData.symbol && (
                    <div className="mt-4">
                        <p className="font-semibold">Symbol: <span className="font-normal">{materialData.symbol}</span></p>
                        {materialData.atomic_number && (
                            <p className="font-semibold">Atomic Number: <span className="font-normal">{materialData.atomic_number}</span></p>
                        )}
                    </div>
                )}
            </div>
            <div className="space-y-2">
                <Score label="Overall Risk Score" value={materialData.overall_risk_score} />
                <Score label="Investment Opportunity" value={materialData.investment_opportunity_score} />
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <main className="md:col-span-3">
                {materialData.short_summary && (
                    <div className="mb-6 p-4 bg-muted/30 rounded-lg border-l-4 border-primary">
                        <p className="text-lg leading-relaxed">{materialData.short_summary}</p>
                    </div>
                )}
                
                <div className="prose prose-sm dark:prose-invert max-w-none mb-12">
                    <p>{materialData.summary}</p>
                </div>

                <Section id={reportSections[0].id} title={reportSections[0].title} icon={reportSections[0].icon}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <ScoreCard label="Overall Risk" value={materialData.overall_risk_score} />
                        <ScoreCard label="Criticality" value={materialData.criticality_score} />
                        <ScoreCard label="National Security" value={materialData.national_security_score} />
                        <ScoreCard label="Strategic Importance" value={materialData.strategic_importance_score} />
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <ScoreCard label="Supply Chain Risk" value={materialData.supply_chain_vulnerability_score} />
                        <ScoreCard label="Demand Outlook" value={materialData.demand_outlook_score} />
                        <ScoreCard label="Investment Opportunity" value={materialData.investment_opportunity_score} />
                        <ScoreCard label="Market Timing" value={materialData.market_timing_score} />
                    </div>
                </Section>

                <Section id={reportSections[1].id} title={reportSections[1].title} icon={reportSections[1].icon}>
                    <SubSection title="Market Fundamentals">
                        <DataPoint label="Market Size" value={`$${materialData.market_size_usd_billions}B globally`} />
                        <DataPoint label="Annual Growth" value={materialData.annual_growth_rate_pct ? `${(materialData.annual_growth_rate_pct * 100).toFixed(2)}%` : "N/A"} />
                        <MarkdownText label="Market Stage" content={materialData.market_maturity_stage} />
                        <MarkdownText label="Key Industries" content={materialData.industries} />
                    </SubSection>
                    <SubSection title="Current Pricing">
                        <DataPoint label="Market Price" value={`$${materialData.current_market_value_kg}/kg`} />
                        <DataPoint label="Upside Potential" value={`$${materialData.best_case_value_kg}/kg`} />
                        <DataPoint label="Typical Margins" value={materialData.typical_margin_pct_low && materialData.typical_margin_pct_high ? `${(materialData.typical_margin_pct_low * 100).toFixed(2)}% - ${(materialData.typical_margin_pct_high * 100).toFixed(2)}%` : "N/A"} />
                    </SubSection>
                    <SubSection title="Market Dynamics">
                        <MarkdownText label="Demand Outlook" content={materialData.demand_outlook} />
                        <MarkdownText label="Supply Outlook" content={materialData.supply_outlook} />
                        <MarkdownText label="Price Trends" content={materialData.price_trends} />
                        <div className="grid grid-cols-3 gap-4 mt-4">
                            <Score label="Demand Outlook" value={materialData.demand_outlook_score} />
                            <Score label="Supply Outlook" value={materialData.supply_outlook_score} />
                            <Score label="Price Trends" value={materialData.price_trends_score} />
                        </div>
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <Score label="Demand Elasticity" value={materialData.demand_elasticity_score} />
                            <DataPoint label="Market Concentration (HHI)" value={materialData.market_concentration_hhi} />
                        </div>
                    </SubSection>
                </Section>

                <Section id={reportSections[2].id} title={reportSections[2].title} icon={reportSections[2].icon}>
                    <SubSection title="Deal Characteristics">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr>
                                    <th className="border-b p-2">Metric</th>
                                    <th className="border-b p-2">Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td className="border-b p-2">Typical Lot Size</td><td className="border-b p-2">{materialData.typical_lot_size_kg} kg</td></tr>
                                <tr><td className="border-b p-2">Deal Size Range</td><td className="border-b p-2">${materialData.typical_deal_size_min_usd} - ${materialData.typical_deal_size_max_usd}</td></tr>
                                <tr><td className="border-b p-2">Minimum Order</td><td className="border-b p-2">${materialData.minimum_order_value_usd}</td></tr>
                                <tr><td className="border-b p-2">Settlement Period</td><td className="border-b p-2">{materialData.typical_settlement_days} days</td></tr>
                                <tr><td className="border-b p-2">Annual Trading Volume</td><td className="border-b p-2">{materialData.trading_volume_annual_tonnes} tonnes</td></tr>
                                <tr><td className="border-b p-2">Inventory Turnover</td><td className="border-b p-2">{materialData.inventory_turnover_days} days</td></tr>
                                <tr><td className="border-b p-2">Major Trading Hubs</td><td className="border-b p-2"><StringArrayDisplay content={materialData.major_trading_hubs} displayAs="text" /></td></tr>
                            </tbody>
                        </table>
                    </SubSection>
                    <SubSection title="Market Dynamics">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <Score label="Liquidity Score" value={materialData.market_liquidity_score} />
                            <Score label="Price Discovery" value={materialData.price_discovery_score} />
                            <Score label="Market Maker Potential" value={materialData.market_maker_potential} />
                            <Score label="Deal Frequency" value={materialData.deal_frequency_score} />
                            <Score label="Brokerage Opportunity" value={materialData.brokerage_opportunity_score} />
                            <Score label="Client Stickiness" value={materialData.client_stickiness_score} />
                        </div>
                    </SubSection>
                    <SubSection title="Trading Risks">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <Score label="Counterparty Concentration" value={materialData.counterparty_concentration_score} />
                            <Score label="Transaction Size Risk" value={materialData.transaction_size_risk_score} />
                            <Score label="Contract Settlement Risk" value={materialData.contract_settlement_risk_score} />
                            <Score label="Relationship Dependency" value={materialData.relationship_dependency_score} />
                        </div>
                        <MarkdownText label="Arbitrage Opportunities" content={materialData.arbitrage_opportunities} />
                        <MarkdownText label="Seasonal Demand Patterns" content={materialData.seasonal_demand_patterns} />
                    </SubSection>
                </Section>

                <Section id={reportSections[3].id} title={reportSections[3].title} icon={reportSections[3].icon}>
                    <SubSection title="Investment Metrics">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr>
                                    <th className="border-b p-2">Factor</th>
                                    <th className="border-b p-2">Score</th>
                                    <th className="border-b p-2">Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr><td className="border-b p-2">ROI Potential</td><td className="border-b p-2">{materialData.roi_potential_score}/5</td><td className="border-b p-2">{materialData.payback_period_months} month payback</td></tr>
                                <tr><td className="border-b p-2">Competitive Moat</td><td className="border-b p-2">{materialData.competitive_moat_strength}/5</td><td className="border-b p-2">Market defensibility</td></tr>
                                <tr><td className="border-b p-2">Capital Intensity</td><td className="border-b p-2">{materialData.capital_intensity_score}/5</td><td className="border-b p-2">Upfront investment needs</td></tr>
                            </tbody>
                        </table>
                    </SubSection>
                    <SubSection title="Risk Assessment">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <Score label="ESG Risk" value={materialData.esg_risk_score} />
                            <Score label="Technology Disruption Risk" value={materialData.technology_disruption_risk_score} />
                            <Score label="Security Opportunity" value={materialData.security_opportunity_score} />
                        </div>
                    </SubSection>
                </Section>

                
                <Section id={reportSections[4].id} title={reportSections[4].title} icon={reportSections[4].icon}>
                    <MarkdownText label="National Security Implications" content={materialData.national_security_implications} />
                    <MarkdownText label="Dual-Use Potential" content={materialData.dual_use_potential} />
                    <SubSection title="Strategic Assessment">
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <p className="font-semibold mb-2">Critical to US:</p>
                                <p className="text-sm">{materialData.critical_to_us || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="font-semibold mb-2">Critical to Adversaries:</p>
                                <p className="text-sm">{materialData.critical_to_adversaries || 'N/A'}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <p className="font-semibold mb-2">Critical to Partners:</p>
                                <p className="text-sm">{materialData.critical_to_partners || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="font-semibold mb-2">Critical to Allies:</p>
                                <p className="text-sm">{materialData.critical_to_allies || 'N/A'}</p>
                            </div>
                        </div>
                    </SubSection>
                    <SubSection title="Risk Scores">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <Score label="National Security" value={materialData.national_security_score} />
                            <Score label="Foreign Influence" value={materialData.foreign_influence_score} />
                            <Score label="Supply Chain Weaponization" value={materialData.supply_chain_weaponization_risk} />
                            <Score label="Critical Infrastructure Dependency" value={materialData.critical_infrastructure_dependency} />
                            <Score label="Regulatory Compliance Risk" value={materialData.regulatory_compliance_risk_score} />
                            <Score label="Cyber Security Risk" value={materialData.cyber_security_risk_score} />
                        </div>
                    </SubSection>
                    <SubSection title="Strategic Capabilities">
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <Score label="Domestic Capability Gap" value={materialData.domestic_capability_gap_score} />
                            <Score label="Strategic Reserve Adequacy" value={materialData.strategic_reserve_adequacy_score} />
                        </div>
                        <MarkdownText label="Allied Cooperation Potential" content={materialData.allied_cooperation_potential} />
                        <MarkdownText label="Domestic Production Feasibility" content={materialData.domestic_production_feasibility} />
                        <DataPoint label="Time to Crisis Impact" value={materialData.time_to_crisis_impact_days ? `${materialData.time_to_crisis_impact_days} days` : 'N/A'} />
                        <MarkdownText label="SDA Opportunities" content={materialData.sda_opportunities} />
                    </SubSection>
                </Section>

                <Section id={reportSections[5].id} title={reportSections[5].title} icon={reportSections[5].icon}>
                    <SubSection title="Supply Sources">
                        <MarkdownText label="Source Locations" content={materialData.source_locations} />
                        <MarkdownText label="Current Supply" content={materialData.supply} />
                        <MarkdownText label="Emerging Supply" content={materialData.emerging_supply} />
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                            <Score label="Supply Score" value={materialData.supply_score} />
                            <Score label="Current Supply" value={materialData.current_supply_score} />
                            <Score label="Emerging Supply" value={materialData.emerging_supply_score} />
                            <Score label="Source Locations" value={materialData.source_locations_score} />
                        </div>
                    </SubSection>
                    <SubSection title="Supplier Analysis">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <MarkdownText label="US Suppliers" content={materialData.suppliers_us} />
                                <MarkdownText label="Partner Suppliers" content={materialData.suppliers_partners} />
                            </div>
                            <div>
                                <MarkdownText label="Allied Suppliers" content={materialData.suppliers_allies} />
                                <MarkdownText label="Adversary Suppliers" content={materialData.suppliers_adversaries} />
                            </div>
                        </div>
                        <Score label="Suppliers Friendliness" value={materialData.suppliers_friendliness_score} />
                    </SubSection>
                    <SubSection title="Ownership & Control">
                        <MarkdownText label="Ownership Structure" content={materialData.ownership} />
                        <DataPoint label="Ownership Concentration Holder" value={materialData.ownership_concentration_holder} />
                        <DataPoint label="Ownership Concentration Share" value={materialData.ownership_concentration_share_pct ? `${materialData.ownership_concentration_share_pct}%` : 'N/A'} />
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <Score label="Ownership Score" value={materialData.ownership_score} />
                            <Score label="Ownership Concentration" value={materialData.ownership_concentration_score} />
                        </div>
                    </SubSection>
                    <SubSection title="Processing & Chokepoints">
                        <MarkdownText label="Processing" content={materialData.processing} />
                        <MarkdownText label="Chokepoints" content={materialData.chokepoints} />
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <Score label="Processing Score" value={materialData.processing_score} />
                            <Score label="Chokepoints Score" value={materialData.chokepoints_score} />
                        </div>
                    </SubSection>
                    <SubSection title="Vulnerability Scores">
                        <Score label="Supply Chain Vulnerability Score" value={materialData.supply_chain_vulnerability_score} />
                        <Score label="Logistics Complexity Score" value={materialData.logistics_complexity_score} />
                        <Score label="Inventory Holding Risk Score" value={materialData.inventory_holding_risk_score} />
                    </SubSection>
                </Section>

                <Section id={reportSections[6].id} title={reportSections[6].title} icon={reportSections[6].icon}>
                    <SubSection title="Storage & Transportation">
                        <MarkdownText label="Storage Requirements" content={materialData.storage_requirements} />
                        <MarkdownText label="Transportation Methods" content={materialData.transportation_methods} />
                        <MarkdownText label="Quality Specifications" content={materialData.quality_specifications} />
                        <MarkdownText label="Shelf Life Considerations" content={materialData.shelf_life_considerations} />
                    </SubSection>
                    <SubSection title="Financial Considerations">
                        <MarkdownText label="Financing Requirements" content={materialData.financing_requirements} />
                        <MarkdownText label="Insurance Considerations" content={materialData.insurance_considerations} />
                        <MarkdownText label="Customer Switching Costs" content={materialData.customer_switching_costs} />
                    </SubSection>
                </Section>

                <Section id={reportSections[7].id} title={reportSections[7].title} icon={reportSections[7].icon}>
                    <MarkdownText label="Investment Thesis" content={materialData.investment_thesis} />
                    <MarkdownText label="Opportunities" content={materialData.opportunities} />
                    <MarkdownText label="Risks" content={materialData.risks} />
                    <MarkdownText label="Mitigation Recommendations" content={materialData.mitigation_recommendations} />
                    <SubSection title="Alternative Materials">
                        <MarkdownText label="Substitutes" content={materialData.substitutes} />
                        <MarkdownText label="Recycling and Reuse" content={materialData.recycling_and_reuse} />
                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <Score label="Substitutes Score" value={materialData.substitutes_score} />
                            <Score label="Recycling/Reuse Score" value={materialData.recycling_reuse_score} />
                            <Score label="Mitigation Feasibility" value={materialData.mitigation_feasibility_score} />
                        </div>
                    </SubSection>
                    <SubSection title="Strategic Scores">
                        <Score label="Strategic Importance Score" value={materialData.strategic_importance_score} />
                        <Score label="Market Timing Score" value={materialData.market_timing_score} />
                    </SubSection>
                </Section>

                <Section id={reportSections[8].id} title={reportSections[8].title} icon={reportSections[8].icon}>
                    <MarkdownText label="Industries" content={materialData.industries} />
                    <MarkdownText label="Key Buyers" content={materialData.buyers} />
                    <MarkdownText label="Dealers" content={materialData.dealers} />
                    <SubSection title="End Customers & Sectors">
                        <StringArrayDisplay content={materialData.key_end_customers} />
                        <StringArrayDisplay content={materialData.end_market_sectors} />
                    </SubSection>
                </Section>

                <Section id={reportSections[9].id} title={reportSections[9].title} icon={reportSections[9].icon}>
                    <MarkdownText label="Data Sources" content={materialData.data_sources} />
                    <SubSection title="Last Updated">
                        <JsonValue jsonString={materialData.data_last_updated} />
                    </SubSection>
                    <SubSection title="Confidence Score">
                        <JsonValue jsonString={materialData.data_confidence_score} />
                    </SubSection>
                    <SubSection title="Price Reporting Sources">
                        <StringArrayDisplay content={materialData.price_reporting_sources} />
                    </SubSection>
                </Section>

            </main>
            <div className="hidden lg:block md:col-span-1">
                <div className="sticky top-24 space-y-6">
                    <TocSidebar sections={reportSections.map(section => ({ id: section.id, title: section.title }))} />
                    
                    <div className="bg-muted rounded-lg p-4">
                        <h3 className="font-semibold mb-3 text-lg text-center">Overwhelmed? Just Ask Ellen!</h3>
                        <AskEllenButton materialData={materialData} />
                    </div>
                </div>
            </div>
        </div>

        <footer className="text-center text-sm text-muted-foreground mt-12 py-4 border-t">
          <p>This report is generated from TTI Strategic Materials Intelligence Database</p>
        </footer>
    </div>
  );
}
