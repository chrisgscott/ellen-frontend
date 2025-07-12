"use client";

import { useState, useEffect } from "react";
import { AdvancedFilter, RootFilter } from "./AdvancedFilter";

export function CustomOpportunities() {
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  // Initial state for a custom filter is an empty root group.
  // The root group is always 'OR', allowing users to create multiple independent filter groups.
  const initialFilterState: RootFilter = {
    id: 'root',
    logic: 'or',
    children: [],
    type: 'group',
  };

  return (
    <div>
      <AdvancedFilter
        initialFilterState={initialFilterState}
        onResultsChange={setResults}
        onLoadingChange={setLoading}
        onErrorChange={setError}
        onQueryChange={setQuery}
      />
      {error && <p className="text-red-500 text-sm pt-2">Error: {error}</p>}

      <div className="mt-6">
        {loading ? (
          <p>Loading...</p>
        ) : (
          <div>
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold">Filtered Opportunities</h3>
                <p className="text-sm text-muted-foreground">
                  Based on your custom filter criteria.
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-700">
                  {results.length} {results.length === 1 ? 'Match' : 'Matches'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {results.map(item => (
                <div key={item.id} className="border p-4 rounded-lg">
                  <h3 className="font-bold">{item.material}</h3>
                  <p className="text-sm text-gray-600">{item.short_summary}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
