import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        // IMPORTANT: Make sure to switch to your production domain in production
        domain: process.env.NODE_ENV === 'production' ? '.your-domain.com' : 'localhost',
        path: '/',
      },
    },
  );
}
