"use client";

import { useState } from 'react';
import { AdvancedFilter, RootFilter } from "./AdvancedFilter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

// Helper function to determine opportunity details
const getOpportunityDetails = (opportunity: any) => {
  const details: { type: string; reason: string }[] = [];
  if (opportunity.domestic_production_feasibility > 4 && opportunity.national_security_score > 4) {
    details.push({ type: "Build Domestic Capacity", reason: `Very high domestic production difficulty (${opportunity.domestic_production_feasibility}) and very high national security score (${opportunity.national_security_score}).` });
  }
  if (opportunity.suppliers_friendliness_score > 4 && opportunity.national_security_score > 4) {
    details.push({ type: "Reduce Adversary Dependence", reason: `Very high dependency on unfriendly suppliers (score: ${opportunity.suppliers_friendliness_score}) and very high national security importance (score: ${opportunity.national_security_score}).` });
  }
  if (opportunity.strategic_reserve_adequacy_score > 4 && opportunity.national_security_score > 4) {
    details.push({ type: "Fill Strategic Reserves", reason: `Strategic reserve adequacy is very low (score: ${opportunity.strategic_reserve_adequacy_score}) and national security importance is very high (score: ${opportunity.national_security_score}).` });
  }
  if (opportunity.allied_cooperation_potential < 2 && opportunity.domestic_capability_gap_score > 4) {
    details.push({ type: "Allied Partnership Leverage", reason: `Very strong allied cooperation potential (${opportunity.allied_cooperation_potential}) and a very significant domestic capability gap (${opportunity.domestic_capability_gap_score}).` });
  }
  return details;
};

export function ImproveUSPosition() {
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
          { id: 'c1', type: 'condition', field: 'domestic_production_feasibility', operator: 'gt', value: '4' },
          { id: 'c2', type: 'condition', field: 'national_security_score', operator: 'gt', value: '4' },
        ]
      },
      {
        id: 'group-2',
        logic: 'and',
        type: 'group',
        children: [
          { id: 'c3', type: 'condition', field: 'suppliers_friendliness_score', operator: 'gt', value: '4' },
          { id: 'c4', type: 'condition', field: 'national_security_score', operator: 'gt', value: '4' },
        ]
      },
      {
        id: 'group-3',
        logic: 'and',
        type: 'group',
        children: [
          { id: 'c5', type: 'condition', field: 'strategic_reserve_adequacy_score', operator: 'gt', value: '4' },
          { id: 'c6', type: 'condition', field: 'national_security_score', operator: 'gt', value: '4' },
        ]
      },
      {
        id: 'group-4',
        logic: 'and',
        type: 'group',
        children: [
          { id: 'c7', type: 'condition', field: 'allied_cooperation_potential', operator: 'lt', value: '2' },
          { id: 'c8', type: 'condition', field: 'domestic_capability_gap_score', operator: 'gt', value: '4' },
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
                <h3 className="text-lg font-semibold">Improve US Position</h3>
                <p className="text-sm text-muted-foreground">
                  Opportunities to enhance the United States' strategic standing in critical materials.
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
                    <span key={type} className="inline-block bg-blue-100 text-blue-800 text-xs font-medium mr-2 mt-1 px-2.5 py-0.5 rounded-full">
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
