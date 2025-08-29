import { NewsFeedSidebar } from "@/components/newsfeed-sidebar";
import { Suspense } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Page() {
  return (
    <div className="flex-1 p-4 pt-6 md:p-8">
      <div className="mb-4 flex justify-end">
        <Link href="/home">
          <Button variant="outline" size="sm">Try Perplexity-Style UI</Button>
        </Link>
      </div>
      <div className="flex gap-6 h-[calc(100vh-200px)]">
        {/* Main Content Area - 2/3 width */}
        <div className="flex-1 flex items-center justify-center rounded-lg border-2 border-dashed">
          <p className="text-muted-foreground">Dashboard content will go here.</p>
        </div>
        
        {/* News Feed Sidebar - 1/3 width */}
        <div className="w-1/3 min-w-[320px] max-w-[400px]">
          <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading news…</div>}>
            <NewsFeedSidebar 
              apiEndpoint="/api/news"
              className="w-full max-w-none"
            />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

