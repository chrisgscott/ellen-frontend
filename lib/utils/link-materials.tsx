import React from 'react';
import Link from 'next/link';

export interface MaterialInfo {
  id: string;
  material: string;
}

/**
 * Common aliases/shorthands that map to official material names.
 * Keys are lowercase aliases, values are the official material names.
 */
const MATERIAL_ALIASES: Record<string, string> = {
  'rare earths': 'Rare earth elements',
  'rare earth': 'Rare earth elements',
  'rees': 'Rare earth elements',
  'graphite': 'Natural graphite',
  'electrical steel': 'Electrical steel (grain-oriented, non-grain-oriented, and amorphous)',
  'sic': 'Silicon carbide',
  'natural rubber': 'Rubber (natural)',
  'pgm': 'Platinum',
  'pgms': 'Platinum',
  'platinum group': 'Platinum',
  'platinum group metals': 'Platinum',
  'li': 'Lithium',
  'co': 'Cobalt',
  'ni': 'Nickel',
  'cu': 'Copper',
  'al': 'Aluminum',
  'ti': 'Titanium',
  'w': 'Tungsten',
  'mo': 'Molybdenum',
  'nb': 'Niobium',
  'ta': 'Tantalum',
  'ga': 'Gallium',
  'ge': 'Germanium',
  'in': 'Indium',
  'sb': 'Antimony',
  'te': 'Tellurium',
  'bi': 'Bismuth',
  'czt': 'Cadmium Zinc Telluride',
};

/**
 * Creates a regex pattern that matches any of the material names or aliases.
 * Sorts by length (longest first) to match longer names before shorter ones
 * (e.g., "Rare earth elements" before "Rare").
 */
export function createMaterialMatcher(materials: MaterialInfo[]): RegExp | null {
  if (!materials || materials.length === 0) return null;
  
  // Collect all matchable terms: official names + aliases
  const allTerms = new Set<string>();
  
  // Add official material names
  for (const m of materials) {
    allTerms.add(m.material);
  }
  
  // Add aliases (only if the target material exists)
  const materialNamesLower = new Set(materials.map(m => m.material.toLowerCase()));
  for (const [alias, target] of Object.entries(MATERIAL_ALIASES)) {
    if (materialNamesLower.has(target.toLowerCase())) {
      allTerms.add(alias);
    }
  }
  
  // Sort by length descending to match longer names first
  const sortedTerms = [...allTerms].sort((a, b) => b.length - a.length);
  
  // Escape special regex characters
  const escapedTerms = sortedTerms.map(term => 
    term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  
  // Create pattern with word boundaries for clean matching
  const pattern = `\\b(${escapedTerms.join('|')})\\b`;
  
  return new RegExp(pattern, 'gi');
}

/**
 * Creates a map from lowercase material name/alias to material info for quick lookup
 */
export function createMaterialMap(materials: MaterialInfo[]): Map<string, MaterialInfo> {
  const map = new Map<string, MaterialInfo>();
  
  // Add official names
  for (const mat of materials) {
    map.set(mat.material.toLowerCase(), mat);
  }
  
  // Add aliases pointing to their target materials
  for (const [alias, target] of Object.entries(MATERIAL_ALIASES)) {
    const targetMaterial = map.get(target.toLowerCase());
    if (targetMaterial) {
      map.set(alias.toLowerCase(), targetMaterial);
    }
  }
  
  return map;
}

/**
 * Processes a text string and returns React nodes with material names linked.
 * Non-matching text is returned as-is, matching material names become Links.
 */
export function linkMaterialsInText(
  text: string,
  matcher: RegExp | null,
  materialMap: Map<string, MaterialInfo>
): React.ReactNode {
  if (!matcher || !text) return text;
  
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  
  // Reset regex state
  matcher.lastIndex = 0;
  
  while ((match = matcher.exec(text)) !== null) {
    const matchedText = match[0];
    const matchIndex = match.index;
    
    // Add text before the match
    if (matchIndex > lastIndex) {
      parts.push(text.slice(lastIndex, matchIndex));
    }
    
    // Look up the material info
    const materialInfo = materialMap.get(matchedText.toLowerCase());
    
    if (materialInfo) {
      // Add the linked material name
      parts.push(
        <Link
          key={`${materialInfo.id}-${matchIndex}`}
          href={`/home/research/${encodeURIComponent(materialInfo.material)}`}
          className="text-primary hover:underline font-medium"
        >
          {matchedText}
        </Link>
      );
    } else {
      // Fallback: just add the text (shouldn't happen, but safety first)
      parts.push(matchedText);
    }
    
    lastIndex = matchIndex + matchedText.length;
  }
  
  // Add remaining text after last match
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  
  // If no matches found, return original text
  if (parts.length === 0) return text;
  
  return <>{parts}</>;
}

/**
 * Checks if a React element is or contains a link
 */
function isOrContainsLink(element: React.ReactElement): boolean {
  const elementType = element.type;
  
  // Check if this element is a link
  if (typeof elementType === 'string' && elementType === 'a') {
    return true;
  }
  
  // Check if it's a Next.js Link component
  if (typeof elementType === 'function' && 
      (elementType.name === 'Link' || elementType.name === 'LinkComponent')) {
    return true;
  }
  
  return false;
}

/**
 * Recursively processes React children to link material names in text nodes.
 * Skips processing inside headings (h1-h6) and existing links.
 */
export function processChildrenWithMaterialLinks(
  children: React.ReactNode,
  matcher: RegExp | null,
  materialMap: Map<string, MaterialInfo>,
  insideLink: boolean = false
): React.ReactNode {
  if (!matcher) return children;
  
  return React.Children.map(children, (child) => {
    // If it's a string, process it (but only if not inside a link)
    if (typeof child === 'string') {
      if (insideLink) {
        return child; // Don't create links inside links
      }
      return linkMaterialsInText(child, matcher, materialMap);
    }
    
    // If it's not a valid React element, return as-is
    if (!React.isValidElement(child)) {
      return child;
    }
    
    // Check if this element is a link
    const isLink = isOrContainsLink(child);
    
    // Don't process inside headings
    const elementType = child.type;
    if (
      typeof elementType === 'string' && 
      elementType.match(/^h[1-6]$/)
    ) {
      return child;
    }
    
    // If it's a link, don't process its children for more links
    if (isLink) {
      return child;
    }
    
    // Recursively process children of this element
    const childProps = child.props as Record<string, unknown>;
    if (childProps.children) {
      return React.cloneElement(child, {
        ...childProps,
        children: processChildrenWithMaterialLinks(
          childProps.children as React.ReactNode,
          matcher,
          materialMap,
          insideLink // Pass through the insideLink flag
        ),
      } as React.Attributes);
    }
    
    return child;
  });
}
