'use client';

import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export default function ResearchIndexPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-80 w-80">
          <DotLottieReact
            src="https://lottie.host/f1bb5c31-1a10-4452-b5e7-ca002f92fd42/EB1NNK9lqH.lottie"
            loop
            autoplay
          />
        </div>
        <h2 className="mt-0 text-xl font-semibold">Select a Material</h2>
        <p className="mt-2 text-muted-foreground">
          Choose a material from the sidebar to view its intelligence report.
        </p>
      </div>
    </div>
  );
}
