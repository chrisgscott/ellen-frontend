"use client";

import { useState } from 'react';
import { AdvancedFilter, RootFilter } from "./AdvancedFilter";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";

const getOpportunityDetails = (opportunity: any) => {
  const details: { type: string; reason: string }[] = [];
  if (opportunity.critical_to_adversaries === true && opportunity.chokepoints_score > 3) {
    details.push({ type: "Adversary Chokepoint", reason: `Material is critical to adversaries and presents a chokepoint opportunity (score: ${opportunity.chokepoints_score}).` });
  }
  if (opportunity.ownership_concentration_score > 4) {
    details.push({ type: "Concentrated Ownership", reason: `Ownership is highly concentrated (score: ${opportunity.ownership_concentration_score}).` });
  }
  if (opportunity.suppliers_friendliness_score > 3 && opportunity.substitutes_score < 2) {
    details.push({ type: "Risky Supply, Viable Alternatives", reason: `Supply from unfriendly sources (score: ${opportunity.suppliers_friendliness_score}) but viable alternatives exist (score: ${opportunity.substitutes_score}).` });
  }
  return details;
};

export function DenyAdversaryPosition() {
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
          { id: 'c1', type: 'condition', field: 'critical_to_adversaries', operator: 'eq', value: 'true' },
          { id: 'c2', type: 'condition', field: 'chokepoints_score', operator: 'gt', value: '3' },
        ]
      },
      {
        id: 'c3',
        type: 'condition',
        field: 'ownership_concentration_score',
        operator: 'gt',
        value: '4',
      },
      {
        id: 'group-2',
        logic: 'and',
        type: 'group',
        children: [
          { id: 'c4', type: 'condition', field: 'suppliers_friendliness_score', operator: 'gt', value: '3' },
          { id: 'c5', type: 'condition', field: 'substitutes_score', operator: 'lt', value: '2' },
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
                <h3 className="text-lg font-semibold">Deny Adversary Position</h3>
                <p className="text-sm text-muted-foreground">
                  Opportunities to counter or mitigate adversary control over critical materials.
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
                    <span key={type} className="inline-block bg-red-100 text-red-800 text-xs font-medium mr-2 mt-1 px-2.5 py-0.5 rounded-full">
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
