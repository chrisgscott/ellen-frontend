'use client';

import { DotLottieReact } from '@lottiefiles/dotlottie-react';

export default function SpacesPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
      <DotLottieReact
        src="https://lottie.host/3759d664-8ca0-4e01-8410-28fbec85968d/RIaoTSUUpy.lottie"
        loop
        autoplay
        style={{ width: 300, height: 300 }}
      />
      <h1 className="text-3xl font-medium text-foreground mb-4">Coming Soon</h1>
      <p className="text-muted-foreground">The Spaces feature is currently under construction.</p>
    </div>
  );
}
