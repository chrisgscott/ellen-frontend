import { createClient } from '@/lib/supabase/server';
import { Material } from '@/app/(perplexity-layout)/home/chat/types';

/**
 * Extract materials mentioned in text by searching the materials database
 * Uses case-insensitive search and handles variations in material names
 */
export async function extractMaterials(text: string): Promise<Material[]> {
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
    
    // Check for each material in the text
    materialMap.forEach((material, name) => {
      // Case insensitive search
      const regex = new RegExp(`\\b${name}\\b`, 'i');
      if (regex.test(text)) {
        foundMaterials.add(material);
      }
    });

    return Array.from(foundMaterials);
  } catch (error) {
    console.error('Error extracting materials:', error);
    return [];
  }
}
