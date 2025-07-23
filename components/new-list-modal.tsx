'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { X, Search, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface Material {
  id: string;
  material: string;
}

interface ListData {
  id?: string;
  value?: string; // ID when coming from filter dropdown
  name?: string;
  label?: string; // Name when coming from filter dropdown
  description?: string;
  isGlobal?: boolean;
  materials?: Material[];
}

interface NewListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingList?: ListData | null;
}

export function NewListModal({ open, onOpenChange, editingList }: NewListModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isGlobal, setIsGlobal] = useState('personal');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMaterials, setSelectedMaterials] = useState<Material[]>([]);
  
  const queryClient = useQueryClient();

  // Fetch full list details when editing
  const { data: fullListData, isLoading: isLoadingList } = useQuery({
    queryKey: ['list-details', editingList?.value || editingList?.id],
    queryFn: async () => {
      const listId = editingList?.value || editingList?.id;
      if (!listId) {
        console.log('No editingList ID, returning null');
        return null;
      }
      console.log('Fetching list details for ID:', listId);
      const response = await fetch(`/api/materials/lists?id=${listId}`);
      if (!response.ok) {
        console.error('Failed to fetch list details, status:', response.status);
        throw new Error('Failed to fetch list details');
      }
      const data = await response.json();
      console.log('API response data:', data);
      return data;
    },
    enabled: !!(editingList?.value || editingList?.id),
    staleTime: 30 * 1000,
  });

  // Search materials query
  const { data: searchResults = [], isLoading: isSearching } = useQuery<Material[]>({
    queryKey: ['materials-search', searchQuery],
    queryFn: async () => {
      if (!searchQuery.trim()) return [];
      const response = await fetch(`/api/materials/search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error('Failed to search materials');
      return response.json();
    },
    enabled: searchQuery.trim().length > 0,
    staleTime: 30 * 1000, // 30 seconds
  });

  // Create/Update list mutation
  const saveListMutation = useMutation({
    mutationFn: async (data: {
      id?: string;
      name: string;
      description: string;
      isGlobal: boolean;
      materialIds: string[];
    }) => {
      const url = data.id ? '/api/materials/lists' : '/api/materials/lists';
      const method = data.id ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to ${data.id ? 'update' : 'create'} list`);
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      toast.success(`List ${variables.id ? 'updated' : 'created'} successfully!`);
      queryClient.invalidateQueries({ queryKey: ['material-filters'] });
      queryClient.invalidateQueries({ queryKey: ['materials'] });
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save list');
    },
  });

  const handleClose = () => {
    setName('');
    setDescription('');
    setIsGlobal('personal');
    setSearchQuery('');
    setSelectedMaterials([]);
    onOpenChange(false);
  };

  const handleAddMaterial = (material: Material) => {
    if (!selectedMaterials.find(m => m.id === material.id)) {
      setSelectedMaterials([...selectedMaterials, material]);
      setSearchQuery('');
    }
  };

  const handleRemoveMaterial = (materialId: string) => {
    setSelectedMaterials(selectedMaterials.filter(m => m.id !== materialId));
  };

  // Initialize form with editing data
  React.useEffect(() => {
    console.log('useEffect triggered:', { editingList, fullListData, isLoadingList });
    
    if (editingList && !fullListData) {
      // Use basic data while loading full data
      console.log('Using basic editingList data:', editingList);
      setName(editingList.name || editingList.label || '');
      setDescription(editingList.description || '');
      setIsGlobal(editingList.isGlobal ? 'global' : 'personal');
    } else if (fullListData) {
      // Use full data with materials when available
      console.log('Using fullListData:', fullListData);
      setName(fullListData.name || '');
      setDescription(fullListData.description || '');
      setIsGlobal(fullListData.is_global ? 'global' : 'personal');
      
      // Extract materials from the nested structure
      const materials = fullListData.materials_list_items?.map((item: { materials: { id: string; material: string } }) => ({
        id: item.materials.id,
        material: item.materials.material
      })) || [];
      console.log('Extracted materials:', materials);
      setSelectedMaterials(materials);
    } else if (!editingList) {
      // Reset form when not editing
      console.log('Resetting form - no editingList');
      setName('');
      setDescription('');
      setIsGlobal('personal');
      setSelectedMaterials([]);
    }
  }, [editingList, fullListData, isLoadingList]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('List name is required');
      return;
    }
    
    saveListMutation.mutate({
      id: editingList?.value || editingList?.id,
      name: name.trim(),
      description: description.trim(),
      isGlobal: isGlobal === 'global',
      materialIds: selectedMaterials.map(m => m.id),
    });
  };

  // Filter out already selected materials from search results
  const filteredResults = searchResults.filter(
    material => !selectedMaterials.find(selected => selected.id === material.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingList ? 'Edit List' : 'Create New List'}</DialogTitle>
        </DialogHeader>
        
        {editingList && isLoadingList ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-sm text-muted-foreground">Loading list details...</div>
          </div>
        ) : (
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* List Name */}
          <div className="space-y-2">
            <Label htmlFor="name">List Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter list name..."
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
            />
          </div>

          {/* Visibility */}
          <div className="space-y-3">
            <Label>Visibility</Label>
            <RadioGroup value={isGlobal} onValueChange={setIsGlobal}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="personal" id="personal" />
                <Label htmlFor="personal">Personal - Only visible to me</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="global" id="global" />
                <Label htmlFor="global">Global - Visible to all users</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Materials Selection */}
          <div className="space-y-3">
            <Label>Materials</Label>
            
            {/* Selected Materials */}
            {selectedMaterials.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-muted rounded-md">
                {selectedMaterials.map((material) => (
                  <Badge key={material.id} variant="secondary" className="flex items-center gap-1">
                    {material.material}
                    <button
                      type="button"
                      onClick={() => handleRemoveMaterial(material.id)}
                      className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search materials to add..."
                className="pl-10"
              />
            </div>

            {/* Search Results */}
            {searchQuery && (
              <div className="max-h-48 overflow-y-auto border rounded-md">
                {isSearching ? (
                  <div className="p-4 text-center text-muted-foreground">Searching...</div>
                ) : filteredResults.length > 0 ? (
                  <div className="divide-y">
                    {filteredResults.map((material) => (
                      <button
                        key={material.id}
                        type="button"
                        onClick={() => handleAddMaterial(material)}
                        className="w-full text-left p-3 hover:bg-muted transition-colors flex items-center gap-2"
                      >
                        <Plus className="h-4 w-4 text-muted-foreground" />
                        {material.material}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    No materials found matching &ldquo;{searchQuery}&rdquo;
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={!name.trim() || saveListMutation.isPending}
            >
              {saveListMutation.isPending ? (editingList ? 'Updating...' : 'Creating...') : (editingList ? 'Update List' : 'Create List')}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
