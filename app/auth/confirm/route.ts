import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  console.log('Auth confirm route hit:', { token_hash: token_hash?.substring(0, 10) + '...', type });

  if (token_hash && type) {
    const supabase = await createClient();

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    
    console.log('OTP verification result:', { error: error?.message, type });
    
    if (!error) {
      // For invites, redirect to password setup
      if (type === 'invite') {
        redirect('/auth/set-password');
      } else {
        // Regular email confirmation - redirect to specified URL or home
        redirect(next === '/' ? '/home' : next);
      }
    }
  }

  // redirect the user to an error page with some instructions
  redirect('/auth/error');
}
