import { createClient } from '@/lib/supabase/server';
import { Material } from '@/app/home/chat/types';

/**
 * Extract materials mentioned in text by searching the materials database
 * Uses case-insensitive search and handles variations in material names
 * @param text The text to extract materials from
 * @param materialNames Optional array of material names from structured outputs
 */
export async function extractMaterials(text: string, materialNames?: string[]): Promise<Material[]> {
  try {
    // Initialize Supabase client for this request
    const supabase = await createClient();
    
    // Get all materials from the database
    const { data: allMaterials, error } = await supabase
      .from('materials')
      .select('*');

    if (error) {
      console.error('Error fetching materials:', error);
      return [];
    }

    if (!allMaterials || allMaterials.length === 0) {
      return [];
    }

    // Create a map of material names to material objects for quick lookup
    const materialMap = new Map<string, Material>();
    allMaterials.forEach((material: Material) => {
      materialMap.set(material.material.toLowerCase(), material);
    });

    // Find materials mentioned in the text
    const foundMaterials = new Set<Material>();
    
    // If material names are provided from structured output, prioritize them
    if (materialNames && materialNames.length > 0) {
      console.log('Using structured output material names:', materialNames);
      
      // First try exact matches
      for (const name of materialNames) {
        const lowerName = name.toLowerCase();
        if (materialMap.has(lowerName)) {
          foundMaterials.add(materialMap.get(lowerName)!);
          continue;
        }
        
        // Then try partial matches
        for (const [mapName, material] of materialMap.entries()) {
          if (lowerName.includes(mapName) || mapName.includes(lowerName)) {
            foundMaterials.add(material);
            break;
          }
        }
      }
    }
    
    // If no materials found from structured output or none provided, fall back to text extraction
    if (foundMaterials.size === 0) {
      console.log('Falling back to text-based material extraction');
      // Check for each material in the text
      materialMap.forEach((material, name) => {
        // Case insensitive search
        const regex = new RegExp(`\\b${name}\\b`, 'i');
        if (regex.test(text)) {
          foundMaterials.add(material);
        }
      });
    }

    return Array.from(foundMaterials);
  } catch (error) {
    console.error('Error extracting materials:', error);
    return [];
  }
}
