"use client";

import { useState } from 'react';
import { AdvancedFilter, RootFilter } from "./AdvancedFilter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

const getOpportunityDetails = (opportunity: any) => {
  const details: { type: string; reason: string }[] = [];
  if (opportunity.investment_opportunity_score < 2 && opportunity.roi_potential_score < 2) {
    details.push({ type: "High Investment Potential", reason: `High investment opportunity (score: ${opportunity.investment_opportunity_score}) and ROI potential (score: ${opportunity.roi_potential_score}).` });
  }
  if (opportunity.market_maturity_stage && opportunity.market_maturity_stage.toLowerCase().includes("early") && opportunity.annual_growth_rate_pct > 0.1) {
    details.push({ type: "Early Market Growth", reason: `In an early market maturity stage with high annual growth (${(opportunity.annual_growth_rate_pct * 100).toFixed(2)}%).` });
  }
  if (opportunity.brokerage_opportunity_score < 2 && opportunity.typical_margin_pct_high > 0.15) {
    details.push({ type: "Lucrative Brokerage", reason: `Strong brokerage opportunity (score: ${opportunity.brokerage_opportunity_score}) with high typical margins (${(opportunity.typical_margin_pct_high * 100).toFixed(2)}%).` });
  }
  return details;
};

export function MakeMoney() {
  const [opportunities, setOpportunities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const initialFilterState: RootFilter = {
    id: 'root',
    logic: 'or',
    type: 'group',
    children: [
      {
        id: 'group-1',
        logic: 'and',
        type: 'group',
        children: [
          { id: 'c1', type: 'condition', field: 'investment_opportunity_score', operator: 'lt', value: '2' },
          { id: 'c2', type: 'condition', field: 'roi_potential_score', operator: 'lt', value: '2' },
        ]
      },
      {
        id: 'group-2',
        logic: 'and',
        type: 'group',
        children: [
          { id: 'c3', type: 'condition', field: 'market_maturity_stage', operator: 'ilike', value: 'Early' },
          { id: 'c4', type: 'condition', field: 'annual_growth_rate_pct', operator: 'gt', value: '0.1' },
        ]
      },
      {
        id: 'group-3',
        logic: 'and',
        type: 'group',
        children: [
          { id: 'c5', type: 'condition', field: 'brokerage_opportunity_score', operator: 'lt', value: '2' },
          { id: 'c6', type: 'condition', field: 'typical_margin_pct_high', operator: 'gt', value: '0.15' },
        ]
      },
    ]
  };

  return (
    <div>
      <AdvancedFilter
        initialFilterState={initialFilterState}
        onResultsChange={setOpportunities}
        onLoadingChange={setLoading}
        onErrorChange={setError}
        onQueryChange={setQuery}
        searchOnMount={true}
      />
      {error && <p className="text-red-500 text-sm pt-2">Error: {error}</p>}

      <div className="mt-6">
        {loading ? (
          <p>Loading opportunities...</p>
        ) : (
          <>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">Make a Crap-Ton of Money</h3>
                <p className="text-sm text-muted-foreground">
                  High-potential investment and commercial opportunities in the critical materials market.
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-700">
                  {opportunities.length} {opportunities.length === 1 ? 'Match' : 'Matches'}
                </p>
              </div>
            </div>
            {opportunities.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {opportunities.map((opportunity) => {
            const details = getOpportunityDetails(opportunity);
            const types = details.map(d => d.type);
            return (
              <div key={opportunity.id} className="relative p-4 border rounded-lg">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="absolute top-2 right-2">
                      <Info className="size-4 text-gray-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <ul>
                        {details.map(d => (
                          <li key={d.type}><strong>{d.type}:</strong> {d.reason}</li>
                        ))}
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <div>
                  <h4 className="font-bold">{opportunity.material}</h4>
                  <p className="text-sm text-gray-600">{opportunity.short_summary}</p>
                </div>
                <div className="mt-2">
                  <h5 className="text-xs font-semibold text-gray-500 uppercase">Opportunity Types</h5>
                  {types.map((type) => (
                    <span key={type} className="inline-block bg-green-100 text-green-800 text-xs font-medium mr-2 mt-1 px-2.5 py-0.5 rounded-full">
                      {type}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
            ) : (
              <p>No opportunities found in this category.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
