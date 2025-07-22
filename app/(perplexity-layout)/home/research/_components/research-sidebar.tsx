'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { NavLinks } from './nav-links';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

interface Material {
  id: string;
  material: string;
  lists?: string[];
}

interface FilterOption {
  value: string;
  label: string;
}

interface FilterOptions {
  lists: FilterOption[];
}

// Custom hook for fetching filter options
const useFilterOptions = () => {
  return useQuery<FilterOptions>({
    queryKey: ['material-filters'],
    queryFn: async () => {
      const response = await fetch('/api/materials/filters');
      if (!response.ok) {
        throw new Error('Failed to fetch filter options');
      }
      return response.json();
    },
    staleTime: 30 * 60 * 1000, // 30 minutes - filter options don't change often
  });
};

// Custom hook for fetching materials data
const useMaterialsData = (listFilter: string) => {
  const queryParams = new URLSearchParams();
  if (listFilter && listFilter !== 'all') {
    queryParams.append('list', listFilter);
  }
  
  const apiEndpoint = `/api/materials?${queryParams.toString()}`;

  return useQuery<Material[]>({
    queryKey: ['materials', listFilter],
    queryFn: async () => {
      const response = await fetch(apiEndpoint);
      if (!response.ok) {
        throw new Error('Failed to fetch materials data');
      }
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

const MaterialsSkeleton = () => (
  <div className="space-y-2 p-4">
    {Array.from({ length: 8 }).map((_, i) => (
      <Skeleton key={i} className="h-8 w-full" />
    ))}
  </div>
);

export function ResearchSidebar() {
  const [listFilter, setListFilter] = React.useState('all');
  const { data: materials, isLoading: materialsLoading, error } = useMaterialsData(listFilter);
  const { data: filterOptions, isLoading: filtersLoading } = useFilterOptions();

  if (error) {
    return (
      <div className="h-full border-r flex flex-col">
        <div className="p-4">
          <h2 className="text-lg font-semibold">Materials Library</h2>
          <p className="text-sm text-destructive mt-2">Failed to load materials</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full border-r flex flex-col">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold mb-3">Materials Library</h2>
        
        {/* List Filter */}
        <Select value={listFilter} onValueChange={setListFilter}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="All Lists" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Lists</SelectItem>
            {filterOptions?.lists.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      
      <nav className="flex-grow overflow-y-auto">
        {materialsLoading || filtersLoading ? (
          <MaterialsSkeleton />
        ) : materials && materials.length > 0 ? (
          <NavLinks materials={materials} />
        ) : (
          <div className="p-4 text-center text-muted-foreground">
            {filtersLoading ? 'Loading filters...' : 'No materials found'}
          </div>
        )}
      </nav>
    </div>
  );
}
