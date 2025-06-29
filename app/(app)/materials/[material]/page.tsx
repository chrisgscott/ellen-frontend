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
    BookCopy
} from 'lucide-react';

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

const DataPoint = ({ label, value, unit = '' }: { label: string; value: any; unit?: string }) => (
  <p><span className="font-semibold">{label}:</span> {value ?? 'N/A'}{unit}</p>
);

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

const JsonValue = ({ jsonString }: { jsonString: string }) => {
  try {
    const parsed = JSON.parse(jsonString);
    return <p>{parsed.value ?? 'N/A'}</p>;
  } catch (error) {
    return <p>Error parsing data.</p>;
  }
};

const StringArrayDisplay = ({ content, displayAs = 'badges' }: { content: any, displayAs?: 'badges' | 'text' }) => {
    let items: string[] = [];

    if (typeof content === 'string') {
        try {
            const parsed = JSON.parse(content);
            if (parsed && typeof parsed.value === 'string') {
                // Handles cases like '{"value": "item1, item2"}'
                items = parsed.value.split(',').map((item: string) => item.trim());
            } else if (Array.isArray(parsed.value)) {
                // Handles cases like '{"value": ["item1", "item2"]}'
                items = parsed.value.map(String);
            }
        } catch (e) {
            // Not a JSON string, treat as a simple string
            items = [content];
        }
    } else if (Array.isArray(content)) {
        items = content.map(item => String(item).replace(/^\d+\.\s*/, '').trim());
    }

    if (items.length === 0 || !items[0]) {
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

const BulletPoints = ({ content }: { content: string }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-1" {...props} /> }}>
      {content || 'N/A'}
  </ReactMarkdown>
);

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

const TocSidebar = () => (
  <aside className="sticky top-24">
      <h3 className="font-semibold mb-2 text-lg">On this page</h3>
      <ul className="space-y-2">
          {reportSections.map(section => (
              <li key={section.id}>
                  <a href={`#${section.id}`} className="text-sm text-muted-foreground hover:text-primary transition-colors">
                      {section.title}
                  </a>
              </li>
          ))}
      </ul>
  </aside>
);

export default async function MaterialPage({ params }: { params: { material: string } }) {
  const { material } = await params;
  const supabase = await createClient();
  const materialName = decodeURIComponent(material);

  const { data: materialData, error } = await supabase
    .from("materials")
    .select("*")
    .eq("material", materialName)
    .single();

  if (error || !materialData) {
    notFound();
  }

  return (
    <div className="flex-1 p-4 lg:p-8">
        <header className="mb-8">
            <h1 className="text-4xl font-bold">{materialData.material}</h1>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 pb-8 border-b">
            <div>
                <p className="font-semibold mr-2">Classification:</p>
                <div className="flex flex-wrap gap-2 mt-2">
                    {materialData.lists?.map((list: string) => <Badge key={list}>{list}</Badge>) ?? <p>N/A</p>}
                </div>
            </div>
            <div className="space-y-2">
                <Score label="Overall Risk Score" value={materialData.overall_risk_score} />
                <Score label="Investment Opportunity" value={materialData.investment_opportunity_score} />
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <main className="md:col-span-3">
                <article className="prose prose-sm dark:prose-invert max-w-none mb-12">
                    <p>{materialData.summary || 'No summary available.'}</p>
                </article>

                <Section id={reportSections[0].id} title={reportSections[0].title} icon={reportSections[0].icon}>
                    <SubSection title="Market Fundamentals">
                        <DataPoint label="Market Size" value={`$${materialData.market_size_usd_billions}B globally`} />
                        <DataPoint label="Annual Growth" value={`${materialData.annual_growth_rate_pct}%`} />
                        <DataPoint label="Market Stage" value={materialData.market_maturity_stage} />
                        <DataPoint label="Key Industries" value={materialData.industries} />
                    </SubSection>
                    <SubSection title="Current Pricing">
                        <DataPoint label="Market Price" value={`$${materialData.current_market_value_kg}/kg`} />
                        <DataPoint label="Upside Potential" value={`$${materialData.best_case_value_kg}/kg`} />
                        <DataPoint label="Typical Margins" value={`${materialData.typical_margin_pct_low}% - ${materialData.typical_margin_pct_high}%`} />
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
                    <SubSection title="National Security Implications">
                        <BulletPoints content={materialData.national_security_implications} />
                    </SubSection>
                    <SubSection title="Dual-Use Potential">
                        <BulletPoints content={materialData.dual_use_potential} />
                    </SubSection>
                    <SubSection title="Risk Scores">
                        <Score label="Foreign Influence Score" value={materialData.foreign_influence_score} />
                        <Score label="Supply Chain Weaponization Risk" value={materialData.supply_chain_weaponization_risk} />
                        <Score label="Critical Infrastructure Dependency" value={materialData.critical_infrastructure_dependency} />
                        <Score label="Regulatory Compliance Risk Score" value={materialData.regulatory_compliance_risk_score} />
                    </SubSection>
                </Section>

                <Section id={reportSections[4].id} title={reportSections[4].title} icon={reportSections[4].icon}>
                    <SubSection title="Source Locations">
                        <BulletPoints content={materialData.source_locations} />
                    </SubSection>
                    <SubSection title="Supply Chain">
                        <BulletPoints content={materialData.supply} />
                    </SubSection>
                    <SubSection title="Ownership">
                        <BulletPoints content={materialData.ownership} />
                    </SubSection>
                    <SubSection title="Processing">
                        <BulletPoints content={materialData.processing} />
                    </SubSection>
                    <SubSection title="Chokepoints">
                        <BulletPoints content={materialData.chokepoints} />
                    </SubSection>
                    <SubSection title="Vulnerability Scores">
                        <Score label="Supply Chain Vulnerability Score" value={materialData.supply_chain_vulnerability_score} />
                        <Score label="Logistics Complexity Score" value={materialData.logistics_complexity_score} />
                        <Score label="Inventory Holding Risk Score" value={materialData.inventory_holding_risk_score} />
                    </SubSection>
                </Section>

                <Section id={reportSections[5].id} title={reportSections[5].title} icon={reportSections[5].icon}>
                    <SubSection title="Investment Thesis">
                        <BulletPoints content={materialData.investment_thesis} />
                    </SubSection>
                    <SubSection title="Opportunities">
                        <BulletPoints content={materialData.opportunities} />
                    </SubSection>
                    <SubSection title="Risks">
                        <BulletPoints content={materialData.risks} />
                    </SubSection>
                    <SubSection title="Mitigation Recommendations">
                        <BulletPoints content={materialData.mitigation_recommendations} />
                    </SubSection>
                    <SubSection title="Strategic Scores">
                        <Score label="Strategic Importance Score" value={materialData.strategic_importance_score} />
                        <Score label="Market Timing Score" value={materialData.market_timing_score} />
                    </SubSection>
                </Section>

                <Section id={reportSections[6].id} title={reportSections[6].title} icon={reportSections[6].icon}>
                    <SubSection title="Industries">
                        <BulletPoints content={materialData.industries} />
                    </SubSection>
                    <SubSection title="Key Buyers">
                        <BulletPoints content={materialData.buyers} />
                    </SubSection>
                    <SubSection title="Dealers">
                        <BulletPoints content={materialData.dealers} />
                    </SubSection>
                    <SubSection title="End Customers & Sectors">
                        <StringArrayDisplay content={materialData.key_end_customers} />
                        <StringArrayDisplay content={materialData.end_market_sectors} />
                    </SubSection>
                </Section>

                <Section id={reportSections[7].id} title={reportSections[7].title} icon={reportSections[7].icon}>
                    <SubSection title="Data Sources">
                        <JsonValue jsonString={materialData.data_sources} />
                    </SubSection>
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
                <TocSidebar />
            </div>
        </div>

        <footer className="text-center text-sm text-muted-foreground mt-12 py-4 border-t">
          <p>This report is generated from TTI Strategic Materials Intelligence Database</p>
        </footer>
    </div>
  );
}
