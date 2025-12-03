import React from 'react';
import Link from 'next/link';

export interface MaterialInfo {
  id: string;
  material: string;
}

/**
 * Creates a regex pattern that matches any of the material names.
 * Sorts by length (longest first) to match longer names before shorter ones
 * (e.g., "Rare earth elements" before "Rare").
 */
export function createMaterialMatcher(materials: MaterialInfo[]): RegExp | null {
  if (!materials || materials.length === 0) return null;
  
  // Sort by length descending to match longer names first
  const sortedNames = [...materials]
    .map(m => m.material)
    .sort((a, b) => b.length - a.length);
  
  // Escape special regex characters in material names
  const escapedNames = sortedNames.map(name => 
    name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  
  // Create pattern with word boundaries for clean matching
  // Using \b for word boundary, but also handle cases where material name
  // might be followed by punctuation
  const pattern = `\\b(${escapedNames.join('|')})\\b`;
  
  return new RegExp(pattern, 'gi');
}

/**
 * Creates a map from lowercase material name to material info for quick lookup
 */
export function createMaterialMap(materials: MaterialInfo[]): Map<string, MaterialInfo> {
  const map = new Map<string, MaterialInfo>();
  for (const mat of materials) {
    map.set(mat.material.toLowerCase(), mat);
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
 * Recursively processes React children to link material names in text nodes.
 * Skips processing inside headings (h1-h6) and existing links.
 */
export function processChildrenWithMaterialLinks(
  children: React.ReactNode,
  matcher: RegExp | null,
  materialMap: Map<string, MaterialInfo>
): React.ReactNode {
  if (!matcher) return children;
  
  return React.Children.map(children, (child) => {
    // If it's a string, process it
    if (typeof child === 'string') {
      return linkMaterialsInText(child, matcher, materialMap);
    }
    
    // If it's not a valid React element, return as-is
    if (!React.isValidElement(child)) {
      return child;
    }
    
    // Don't process inside headings or links
    const elementType = child.type;
    if (
      typeof elementType === 'string' && 
      (elementType.match(/^h[1-6]$/) || elementType === 'a')
    ) {
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
          materialMap
        ),
      } as React.Attributes);
    }
    
    return child;
  });
}
