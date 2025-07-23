import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
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

const MarkdownText = ({ label, content }: { label: string; content: string | null }) => {
  if (!content || content.trim() === '') {
    return <p><span className="font-semibold">{label}:</span> N/A</p>;
  }

  // Extract content from JSON if needed
  let processedContent = content;
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === 'object' && parsed.value) {
      processedContent = parsed.value;
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
  const percentage = value ? (value / max) * 100 : 0;
  let variant: "success" | "warning" | "danger" | "default" = "success";
  if (value) {
    if (value >= 4) {
      variant = "danger";
    } else if (value >= 3) {
      variant = "warning";
    }
  }

  return (
    <div className="flex items-center space-x-4">
      <p className="w-1/2 font-semibold">{label}:</p>
      <div className="w-1/2 flex items-center space-x-2">
        <span>{value ?? 'N/A'}/{max}</span>
        <Progress value={percentage} variant={variant} />
      </div>
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
  { id: 'market-overview', title: 'Market Overview', icon: Building },
  { id: 'trading-intelligence', title: 'Trading Intelligence', icon: BarChart3 },
  { id: 'investment-analysis', title: 'Investment Analysis', icon: PieChart },
  { id: 'national-security-assessment', title: 'National Security Assessment', icon: ShieldCheck },
  { id: 'supply-chain-intelligence', title: 'Supply Chain Intelligence', icon: Network },
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
                
                <article className="prose prose-sm dark:prose-invert max-w-none mb-12">
                    <p>{materialData.summary || 'No summary available.'}</p>
                </article>

                <Section id={reportSections[0].id} title={reportSections[0].title} icon={reportSections[0].icon}>
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
                </Section>

                <Section id={reportSections[1].id} title={reportSections[1].title} icon={reportSections[1].icon}>
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
                                <tr><td className="border-b p-2">Minimum Order</td><td className="border-b p-2">${materialData.minimum_order_value_usd}</td></tr>
                                <tr><td className="border-b p-2">Settlement Period</td><td className="border-b p-2">{materialData.typical_settlement_days} days</td></tr>
                                <tr><td className="border-b p-2">Major Trading Hubs</td><td className="border-b p-2"><StringArrayDisplay content={materialData.major_trading_hubs} displayAs="text" /></td></tr>
                            </tbody>
                        </table>
                    </SubSection>
                    <SubSection title="Market Dynamics">
                        <Score label="Liquidity Score" value={materialData.market_liquidity_score} />
                        <Score label="Price Discovery" value={materialData.price_discovery_score} />
                        <Score label="Market Maker Potential" value={materialData.market_maker_potential} />
                    </SubSection>
                </Section>

                <Section id={reportSections[2].id} title={reportSections[2].title} icon={reportSections[2].icon}>
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
                </Section>

                
                <Section id={reportSections[3].id} title={reportSections[3].title} icon={reportSections[3].icon}>
                    <MarkdownText label="National Security Implications" content={materialData.national_security_implications} />
                    <MarkdownText label="Dual-Use Potential" content={materialData.dual_use_potential} />
                    <SubSection title="Risk Scores">
                        <Score label="Foreign Influence Score" value={materialData.foreign_influence_score} />
                        <Score label="Supply Chain Weaponization Risk" value={materialData.supply_chain_weaponization_risk} />
                        <Score label="Critical Infrastructure Dependency" value={materialData.critical_infrastructure_dependency} />
                        <Score label="Regulatory Compliance Risk Score" value={materialData.regulatory_compliance_risk_score} />
                    </SubSection>
                </Section>

                <Section id={reportSections[4].id} title={reportSections[4].title} icon={reportSections[4].icon}>
                    <MarkdownText label="Source Locations" content={materialData.source_locations} />
                    <MarkdownText label="Supply Chain" content={materialData.supply} />
                    <MarkdownText label="Ownership" content={materialData.ownership} />
                    <MarkdownText label="Processing" content={materialData.processing} />
                    <MarkdownText label="Chokepoints" content={materialData.chokepoints} />
                    <SubSection title="Vulnerability Scores">
                        <Score label="Supply Chain Vulnerability Score" value={materialData.supply_chain_vulnerability_score} />
                        <Score label="Logistics Complexity Score" value={materialData.logistics_complexity_score} />
                        <Score label="Inventory Holding Risk Score" value={materialData.inventory_holding_risk_score} />
                    </SubSection>
                </Section>

                <Section id={reportSections[5].id} title={reportSections[5].title} icon={reportSections[5].icon}>
                    <MarkdownText label="Investment Thesis" content={materialData.investment_thesis} />
                    <MarkdownText label="Opportunities" content={materialData.opportunities} />
                    <MarkdownText label="Risks" content={materialData.risks} />
                    <MarkdownText label="Mitigation Recommendations" content={materialData.mitigation_recommendations} />
                    <SubSection title="Strategic Scores">
                        <Score label="Strategic Importance Score" value={materialData.strategic_importance_score} />
                        <Score label="Market Timing Score" value={materialData.market_timing_score} />
                    </SubSection>
                </Section>

                <Section id={reportSections[6].id} title={reportSections[6].title} icon={reportSections[6].icon}>
                    <MarkdownText label="Industries" content={materialData.industries} />
                    <MarkdownText label="Key Buyers" content={materialData.buyers} />
                    <MarkdownText label="Dealers" content={materialData.dealers} />
                    <SubSection title="End Customers & Sectors">
                        <StringArrayDisplay content={materialData.key_end_customers} />
                        <StringArrayDisplay content={materialData.end_market_sectors} />
                    </SubSection>
                </Section>

                <Section id={reportSections[7].id} title={reportSections[7].title} icon={reportSections[7].icon}>
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
