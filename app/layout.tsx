import type { Metadata } from 'next';
import "./globals.css";
import { Outfit } from "next/font/google";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});
import { ThinSidebar } from "@/components/thin-sidebar";
import { QueryProvider } from "@/components/query-provider";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: 'Ellen | AI Critical Materials Analyst',
  description: 'AI-powered critical materials analysis and insights.',
  icons: {
    icon: '/images/ellen-logo.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`flex h-screen bg-background font-sans ${outfit.variable}`}>
        <QueryProvider>
          <ThinSidebar />
          <div className="flex-1 overflow-auto">
            {children}
          </div>
        </QueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
