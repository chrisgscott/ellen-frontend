'use client';

import { ResearchSidebar } from './_components/research-sidebar';
import { QueryProvider } from '@/components/query-provider';

export default function ResearchLayout({ children }: { children: React.ReactNode }) {
  return (
    <QueryProvider>
      <div className="grid h-screen md:grid-cols-[280px_1fr] gap-8">
      <aside className="hidden h-full overflow-y-auto md:block">
        <ResearchSidebar />
      </aside>
      <main className="overflow-y-auto">{children}</main>
      </div>
    </QueryProvider>
  );
}
