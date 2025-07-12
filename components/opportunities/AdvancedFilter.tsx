"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Combobox } from "@/components/ui/combobox";
import { X, Plus, CornerDownLeft } from "lucide-react";

// --- DATA STRUCTURES for Nested Filters ---

export type FilterCondition = {
  id: string;
  field: string;
  operator: string;
  value: any; // Can be string, number, etc.
  type: 'condition';
};

export type FilterGroup = {
  id: string;
  logic: 'and' | 'or';
  children: (FilterCondition | FilterGroup)[];
  type: 'group';
};

export type RootFilter = FilterGroup;

// --- Helper Functions for State Management ---

// Creates a deep copy of the filter state to ensure React re-renders.
const deepCopy = (obj: any) => JSON.parse(JSON.stringify(obj));

// Recursively finds a group or condition's parent group within the filter tree.
const findParentGroup = (nodeId: string, currentGroup: FilterGroup): FilterGroup | null => {
  for (const child of currentGroup.children) {
    if (child.id === nodeId) return currentGroup;
    if (child.type === 'group') {
      const found = findParentGroup(nodeId, child);
      if (found) return found;
    }
  }
  return null;
};

// Recursively finds a specific group by its ID.
const findGroup = (groupId: string, currentGroup: FilterGroup): FilterGroup | null => {
  if (currentGroup.id === groupId) return currentGroup;
  for (const child of currentGroup.children) {
    if (child.type === 'group') {
      const found = findGroup(groupId, child);
      if (found) return found;
    }
  }
  return null;
};

// Recursively finds a specific condition by its ID.
const findCondition = (conditionId: string, group: FilterGroup): FilterCondition | null => {
  for (const child of group.children) {
    if (child.type === 'condition' && child.id === conditionId) return child;
    if (child.type === 'group') {
      const found = findCondition(conditionId, child); // Corrected recursive call
      if (found) return found;
    }
  }
  return null;
};

// --- Operator Definitions ---

const textOperators = [
  { value: 'ilike', label: 'contains' },
  { value: 'eq', label: 'equals' },
  { value: 'ilike_start', label: 'starts with' }, // Custom pseudo-operator
  { value: 'ilike_end', label: 'ends with' },   // Custom pseudo-operator
];

const numberOperators = [
  { value: 'eq', label: 'equals' },
  { value: 'gt', label: 'greater than' },
  { value: 'lt', label: 'less than' },
  { value: 'gte', label: 'greater than or equal to' },
  { value: 'lte', label: 'less than or equal to' },
];

// --- Main Advanced Filter Component ---

interface AdvancedFilterProps {
  initialFilterState: RootFilter;
  onResultsChange: (results: any[]) => void;
  onLoadingChange: (loading: boolean) => void;
  onErrorChange: (error: string | null) => void;
  onQueryChange: (query: string) => void;
  searchOnMount?: boolean;
}

export function AdvancedFilter({ 
  initialFilterState, 
  onResultsChange, 
  onLoadingChange, 
  onErrorChange,
  onQueryChange,
  searchOnMount = false
}: AdvancedFilterProps) {
  const [rootFilter, setRootFilter] = useState<RootFilter>(deepCopy(initialFilterState));
  const [filterableColumns, setFilterableColumns] = useState<{ value: string; label: string; type: 'string' | 'number' }[]>([]);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [isInitialStateValidated, setIsInitialStateValidated] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const fetchSchema = async () => {
      try {
        const response = await fetch('/api/materials/schema');
        if (!response.ok) throw new Error('Failed to fetch schema');
        const data = await response.json();
        setFilterableColumns(data);
      } catch (err: any) { 
        onErrorChange(err.message);
      } finally {
        setSchemaLoading(false);
      }
    };
    fetchSchema();
  }, [onErrorChange]);

  // --- STATE UPDATE HANDLERS ---

  const addCondition = (groupId: string) => {
    const newCondition: FilterCondition = { id: Date.now().toString(), field: '', operator: '', value: '', type: 'condition' };
    const newRoot = deepCopy(rootFilter);
    const group = findGroup(groupId, newRoot);
    if (group) {
      group.children.push(newCondition);
      setRootFilter(newRoot);
    }
  };

  const addGroup = (groupId: string) => {
    const newGroup: FilterGroup = { id: Date.now().toString(), logic: 'and', children: [], type: 'group' };
    const newRoot = deepCopy(rootFilter);
    const parent = findGroup(groupId, newRoot);
    if (parent) {
      parent.children.push(newGroup);
      setRootFilter(newRoot);
    }
  };

  const removeNode = (nodeId: string) => {
    const newRoot = deepCopy(rootFilter);
    const parent = findParentGroup(nodeId, newRoot);
    if (parent) {
      parent.children = parent.children.filter(child => child.id !== nodeId);
      setRootFilter(newRoot);
    } else if (newRoot.id === nodeId) {
      // This case should not happen if we prevent root deletion
      console.warn("Attempted to remove root filter group.");
    }
  };

  const updateCondition = (conditionId: string, field: keyof FilterCondition, value: any) => {
    const newRoot = deepCopy(rootFilter);
    const condition = findCondition(conditionId, newRoot);
    if (condition) {
      (condition[field] as any) = value;
      // If the field changes, reset the operator and value to valid defaults
      if (field === 'field') {
        const newOperators = getOperatorsForField(value); // `value` is the new field name
        condition.operator = newOperators.length > 2 ? newOperators[0].value : ''; // Default to first operator, skip nulls
        condition.value = '';
      }
      setRootFilter(newRoot);
    }
  };

  const changeGroupLogic = (groupId: string, logic: 'and' | 'or') => {
    const newRoot = deepCopy(rootFilter);
    const group = findGroup(groupId, newRoot);
    if (group) {
      group.logic = logic;
      setRootFilter(newRoot);
    }
  };

  // --- QUERY BUILDING ---
  const buildSupabaseQueryString = (group: FilterGroup): string => {
    const parts = group.children.map(child => {
      if (child.type === 'group') {
        // If a subgroup is empty, it shouldn't contribute to the query.
        const subQuery = buildSupabaseQueryString(child);
        return subQuery ? subQuery : '';
      } else { // type is 'condition'
        if (!child.field || !child.operator) return '';
        if (child.value === '' && !['is.null', 'not.is.null'].includes(child.operator)) return '';

        let value = child.value;
        // Handle percentage values
        if (String(child.field).endsWith('_pct') && value) {
            const numericValue = parseFloat(value);
            if (!isNaN(numericValue)) value = (numericValue / 100).toString();
        }

        // Handle special ilike cases
        if (child.operator === 'ilike_start') return `${child.field}.ilike.${value}%`;
        if (child.operator === 'ilike_end') return `${child.field}.ilike.%${value}`;

        return `${child.field}.${child.operator}.${value}`;
      }
    }).filter(Boolean); // Filter out any empty strings

    if (parts.length === 0) return '';
    
    // For the root group, Supabase expects a comma-separated list for the top-level OR.
    // For nested groups, it's `and(filter1,filter2)` or `or(filter1,filter2)`.
    if (group.id === 'root') {
        return parts.join(',');
    }

    return `${group.logic}(${parts.join(',')})`;
  };

  const getOperatorsForField = useCallback((field: string) => {
    if (filterableColumns.length === 0) return [];
    const column = filterableColumns.find(c => c.value === field);
    const baseOperators = column?.type === 'number' ? numberOperators : textOperators;
    return [...baseOperators, { value: 'is.null', label: 'is empty' }, { value: 'not.is.null', label: 'is not empty' }];
  }, [filterableColumns]);

  const runQuery = useCallback(async (filterToUse: RootFilter) => {
    onLoadingChange(true);
    onErrorChange(null);
    try {
      const queryString = buildSupabaseQueryString(filterToUse);
      onQueryChange(queryString);

      if (!queryString) {
        onResultsChange([]);
        onLoadingChange(false);
        return;
      }

      const { data, error } = await supabase.from('materials').select('*').or(queryString);

      if (error) throw error;
      onResultsChange(data || []);
    } catch (err: any) {
      console.error("Error searching:", err);
      onErrorChange(err.message || 'An unknown error occurred.');
      onResultsChange([]);
    } finally {
      onLoadingChange(false);
    }
  }, [supabase, onLoadingChange, onErrorChange, onResultsChange, onQueryChange, buildSupabaseQueryString]);

  // Effect to run search on initial mount if requested
  useEffect(() => {
    if (searchOnMount) {
      runQuery(initialFilterState);
    }
  }, [searchOnMount, initialFilterState, runQuery]);

  useEffect(() => {
    if (schemaLoading || !filterableColumns.length || isInitialStateValidated) {
      return;
    }

    const validatedRoot = deepCopy(initialFilterState);

    const validateGroup = (group: FilterGroup) => {
      group.children.forEach(child => {
        if (child.type === 'group') {
          validateGroup(child);
        } else if (child.type === 'condition') {
          const operators = getOperatorsForField(child.field);
          const operatorExists = operators.some(op => op.value === child.operator);
          if (!operatorExists && operators.length > 0) {
            child.operator = operators[0].value;
          }
        }
      });
    };

    validateGroup(validatedRoot);
    setRootFilter(validatedRoot);
    setIsInitialStateValidated(true);
  }, [schemaLoading, filterableColumns, initialFilterState, isInitialStateValidated, getOperatorsForField]);

  const handleSearch = () => {
    runQuery(rootFilter);
  };

  // --- UI RENDERING ---

  const renderConditionUI = (condition: FilterCondition) => {
    const selectedField = filterableColumns.find(c => c.value === condition.field);
    const inputType = selectedField?.type === 'number' ? 'number' : 'text';

    return (
      <div key={condition.id} className="flex items-center space-x-2">
        <Combobox
          options={filterableColumns}
          value={condition.field}
          onChange={(value) => updateCondition(condition.id, 'field', value || '')}
          placeholder="Select a field..."
        />
        <Select 
          value={condition.operator} 
          onValueChange={value => updateCondition(condition.id, 'operator', value)} 
          disabled={!condition.field}
        >
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Operator" /></SelectTrigger>
          <SelectContent>{getOperatorsForField(condition.field).map(op => <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>)}</SelectContent>
        </Select>
        <Input
          type={inputType}
          value={condition.value}
          onChange={e => updateCondition(condition.id, 'value', e.target.value)}
          placeholder="Value"
          disabled={['is.null', 'not.is.null'].includes(condition.operator)}
          className="w-[150px]"
        />
        <Button variant="ghost" size="icon" onClick={() => removeNode(condition.id)}><X className="h-4 w-4" /></Button>
      </div>
    );
  }

  const renderGroupUI = (group: FilterGroup) => (
    <div key={group.id} className={`p-4 border-l-2 ${group.id === 'root' ? 'border-transparent -ml-4' : 'border-gray-300 ml-4'} space-y-4`}>
      <div className="flex items-center justify-between">
        <RadioGroup 
          value={group.logic} 
          onValueChange={(logic: 'and' | 'or') => changeGroupLogic(group.id, logic)} 
          className="flex items-center space-x-4"
          disabled={group.id === 'root'} // Root group is always OR
        >
          <div className="flex items-center space-x-2"><RadioGroupItem value="and" id={`and-${group.id}`} /><Label htmlFor={`and-${group.id}`}>Match ALL (AND)</Label></div>
          <div className="flex items-center space-x-2"><RadioGroupItem value="or" id={`or-${group.id}`} /><Label htmlFor={`or-${group.id}`}>Match ANY (OR)</Label></div>
        </RadioGroup>
        {group.id !== 'root' && (
          <Button variant="ghost" size="icon" onClick={() => removeNode(group.id)}><X className="h-4 w-4 text-red-500" /></Button>
        )}
      </div>
      
      {group.children.map(child => child.type === 'group' ? renderGroupUI(child) : renderConditionUI(child))}
      
      <div className="flex items-center space-x-2">
        <Button variant="outline" size="sm" onClick={() => addCondition(group.id)}><Plus className="h-4 w-4 mr-2" />Add Condition</Button>
        <Button variant="outline" size="sm" onClick={() => addGroup(group.id)}><CornerDownLeft className="h-4 w-4 mr-2" />Add Group</Button>
      </div>
    </div>
  );

  if (schemaLoading || !isInitialStateValidated) {
    return (
      <div className="space-y-4 p-4 border rounded-lg bg-gray-50/50">
        <p>Loading filter options...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 border rounded-lg bg-gray-50/50">
      {renderGroupUI(rootFilter)}
      <div className="flex items-center space-x-2 pt-4 border-t">
        <Button onClick={handleSearch}>
          Apply Filters
        </Button>
      </div>
    </div>
  );
}
