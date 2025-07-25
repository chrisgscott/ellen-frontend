'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface Material {
  id: string;
  material: string;
}

interface NavLinksProps {
  materials: Material[];
}

export function NavLinks({ materials }: NavLinksProps) {
  const pathname = usePathname();

  const toTitleCase = (str: string) => {
    if (!str) return '';
    return str.replace(
      /\w\S*/g,
      (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  };

  return (
    <ul className="space-y-1 p-4 pt-0">
      {materials.map((material) => {
        const href = `/home/research/${encodeURIComponent(material.material)}`;
        const isActive = pathname === href;
        return (
          <li key={material.id}>
            <Link
              href={href}
              className={cn(
                'block w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground'
              )}
            >
                            {toTitleCase(material.material)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
