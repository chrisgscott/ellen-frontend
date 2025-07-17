import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: {
        // Set domain for production (meetellen.co) and localhost for development
        domain: process.env.NODE_ENV === 'production' ? '.meetellen.co' : 'localhost',
        path: '/',
      },
    },
  );
}
