import { ThinSidebar } from "@/components/thin-sidebar";

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
    </div>
  );
}
