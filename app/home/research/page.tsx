'use client';

import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export default function ResearchIndexPage() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-80 w-80">
          <DotLottieReact
            src="https://lottie.host/ffea7e66-b83e-43a4-9ab7-bad169ac6055/WxZBlyAg1W.lottie"
            loop
            autoplay
          />
        </div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">Select a Material</h2>
        <p className="text-muted-foreground">
          Choose a material from the sidebar to view its intelligence report.
        </p>
      </div>
    </div>
  );
}
