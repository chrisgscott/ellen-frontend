import { ThinSidebar } from "@/components/thin-sidebar";
import { Toaster } from "@/components/ui/toaster";

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
