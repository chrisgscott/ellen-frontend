import type { Metadata } from 'next';
import { ThinSidebar } from "@/components/thin-sidebar";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'Ellen | AI Critical Materials Analyst',
  description: 'AI-powered critical materials analysis and insights.',
  icons: {
    icon: '/images/ellen-logo.svg',
  },
};

export default function PerplexityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background">
      <ThinSidebar />
      <div className="flex-1 overflow-auto">
        {children}
      </div>
      <Toaster />
    </div>
  );
}
