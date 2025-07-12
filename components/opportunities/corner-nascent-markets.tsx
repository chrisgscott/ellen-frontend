"use client";

import { useState } from 'react';
import { AdvancedFilter, RootFilter } from "./AdvancedFilter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

const getOpportunityDetails = (opportunity: any) => {
  const details: { type: string; reason: string }[] = [];
  if (opportunity.industries?.toLowerCase().includes("emerging")) {
    details.push({ type: "Emerging Applications", reason: `Material has emerging applications in industries like: ${opportunity.industries}.` });
  }
  if (opportunity.market_concentration_hhi < 1500 && opportunity.annual_growth_rate_pct > 0.1) {
    details.push({ type: "Low Concentration, High Growth", reason: `Market has low concentration (HHI: ${opportunity.market_concentration_hhi}) and high growth (${(opportunity.annual_growth_rate_pct * 100).toFixed(2)}%).` });
  }
  if (opportunity.market_maturity_stage?.toLowerCase().includes("early") && opportunity.demand_outlook_score < 2) {
    details.push({ type: "Early Stage, High Demand", reason: `Market is in an early stage with high demand outlook (score: ${opportunity.demand_outlook_score}).` });
  }
  return details;
};

export function CornerNascentMarkets() {
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
        id: 'c1',
        type: 'condition',
        field: 'industries',
        operator: 'ilike',
        value: 'emerging'
      },
      {
        id: 'group-1',
        logic: 'and',
        type: 'group',
        children: [
          { id: 'c2', type: 'condition', field: 'market_concentration_hhi', operator: 'lt', value: '1500' },
          { id: 'c3', type: 'condition', field: 'annual_growth_rate_pct', operator: 'gt', value: '0.1' },
        ]
      },
      {
        id: 'group-2',
        logic: 'and',
        type: 'group',
        children: [
          { id: 'c4', type: 'condition', field: 'market_maturity_stage', operator: 'ilike', value: 'early' },
          { id: 'c5', type: 'condition', field: 'demand_outlook_score', operator: 'lt', value: '2' },
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
                <h3 className="text-lg font-semibold">Corner Nascent Markets</h3>
                <p className="text-sm text-muted-foreground">
                  Opportunities to establish a dominant position in emerging materials or applications.
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
                    <span key={type} className="inline-block bg-purple-100 text-purple-800 text-xs font-medium mr-2 mt-1 px-2.5 py-0.5 rounded-full">
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
