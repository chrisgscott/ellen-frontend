'use client';

import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { NavLinks } from './nav-links';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { NewListModal } from '@/components/new-list-modal';
import { Plus, Globe, User, MoreHorizontal, Edit, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface Material {
  id: string;
  material: string;
  lists?: string[];
}

interface FilterOption {
  value: string;
  label: string;
  isGlobal?: boolean;
  isOwnedByUser?: boolean;
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
  const [showNewListModal, setShowNewListModal] = React.useState(false);
  const [editingList, setEditingList] = React.useState<any>(null);
  const { data: materials, isLoading: materialsLoading, error } = useMaterialsData(listFilter);
  const { data: filterOptions, isLoading: filtersLoading } = useFilterOptions();
  
  const queryClient = useQueryClient();

  // Delete list mutation
  const deleteListMutation = useMutation({
    mutationFn: async (listId: string) => {
      const response = await fetch(`/api/materials/lists?id=${listId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete list');
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success('List deleted successfully!');
      queryClient.invalidateQueries({ queryKey: ['material-filters'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      // Reset filter if we deleted the currently selected list
      if (listFilter !== 'all') {
        setListFilter('all');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete list');
    },
  });

  const handleEditList = (option: any) => {
    console.log('handleEditList called with option:', option);
    setEditingList(option);
    setShowNewListModal(true);
  };

  const handleDeleteList = async (listId: string, listName: string) => {
    if (window.confirm(`Are you sure you want to delete the list "${listName}"? This action cannot be undone.`)) {
      deleteListMutation.mutate(listId);
    }
  };

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
              <div key={option.value} className="flex items-center">
                <SelectItem value={option.value} className="flex-1">
                  <div className="flex items-center gap-2">
                    {option.isGlobal ? (
                      <Globe className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                    {option.label}
                  </div>
                </SelectItem>
                {option.isOwnedByUser && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button 
                        className="p-1 hover:bg-accent rounded-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditList(option)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleDeleteList(option.value, option.label)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
            <div className="border-t mt-1 pt-1">
              <button
                onClick={() => setShowNewListModal(true)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                New List
              </button>
            </div>
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
      
      <NewListModal 
        open={showNewListModal} 
        onOpenChange={(open) => {
          setShowNewListModal(open);
          if (!open) {
            setEditingList(null);
          }
        }}
        editingList={editingList}
      />
    </div>
  );
}
