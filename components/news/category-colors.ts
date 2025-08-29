// Shared category color mapping for badges and chips across the app
// Keep tones low-saturation and provide dark-mode variants. Fallback to neutral.

export function getCategoryColor(categoryInput: string | null | undefined): string {
  const category = String(categoryInput || '').trim();
  const key = normalize(category);

  // Base palette for canonical buckets
  const colors: Record<string, string> = {
    // Exact enum labels (normalized)
    material_profiles: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-200",
    supply_chains_markets: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    geopolitics_policy: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
    mining_extraction: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    processing_refining: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    clean_energy_technology_applications: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
    innovation_r_d: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
    investment_finance: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    sustainability_ethics: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
    country_region_profiles: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-200",

    policy: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
    regulation: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",

    finance: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    investment: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
    markets: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",

    technology: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
    r_and_d: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
    research: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",

    supply_chain: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    manufacturing: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    logistics: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    production: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    mining: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
    exploration: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",

    environment: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
    esg: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",
    climate: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-200",

    security: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
    geopolitics: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
    trade: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",
    defense: "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200",

    materials: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-200",
    general: "bg-slate-100 text-slate-800 dark:bg-slate-900/40 dark:text-slate-200",
  };

  // Exact match first
  if (colors[key]) return colors[key];

  // Heuristic mapping for composite/unknown categories
  // Order matters: map to the most semantically prominent bucket
  if (containsAny(key, ['policy', 'regulation'])) return colors['policy'];
  if (containsAny(key, ['finance', 'investment', 'market'])) return colors['finance'];
  if (containsAny(key, ['technology', 'tech', 'r_and_d', 'research', 'innovation'])) return colors['technology'];
  if (containsAny(key, ['supply', 'chain', 'logistics', 'manufactur', 'production'])) return colors['supply_chain'];
  if (containsAny(key, ['mining', 'exploration'])) return colors['mining'];
  if (containsAny(key, ['environment', 'esg', 'climate', 'sustain'])) return colors['environment'];
  if (containsAny(key, ['security', 'geopolit', 'trade', 'defense'])) return colors['security'];
  if (containsAny(key, ['material'])) return colors['materials'];

  return colors['general'];
}

function normalize(value: string): string {
  if (!value) return 'general';
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function containsAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}
