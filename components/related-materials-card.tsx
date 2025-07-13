'use client';

import Link from 'next/link';

interface Material {
  uuid: string;
  name: string;
  short_summary: string;
  symbol?: string; // e.g. "Mg"
  material_card_color?: string; // hex string
}

interface RelatedMaterialsCardProps {
  material: Material;
}

export function RelatedMaterialsCard({ material }: RelatedMaterialsCardProps) {
  const symbol = material.symbol ?? `${material.name.charAt(0).toUpperCase()}${material.name.charAt(1)?.toLowerCase() ?? ''}`;
  return (
    <Link href={`/materials/${encodeURIComponent(material.name)}`} passHref>
      <div className="min-w-[240px] max-w-[280px] h-24 flex items-center gap-4 bg-gray-100 hover:shadow-md transition-shadow cursor-pointer rounded-xl border p-4 overflow-hidden">
        {/* Element-like square */}
        <div
          className="w-12 h-12 flex items-center justify-center rounded-md text-white text-lg font-semibold flex-shrink-0"
          style={{ backgroundColor: material.material_card_color ?? '#6b7280' /* default gray-500 */ }}
        >
          {symbol}
        </div>

        {/* Name & description */}
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-foreground text-sm leading-tight truncate">{material.name}</h3>
          <p className="text-xs text-muted-foreground overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{material.short_summary}</p>
        </div>
      </div>
    </Link>
  );
}
