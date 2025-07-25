import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  // const next = searchParams.get("next") ?? "/"; // Reserved for future use

  console.log('Auth confirm route hit:', { token_hash: token_hash?.substring(0, 10) + '...', type });

  if (token_hash && type) {
    const supabase = await createClient();

    const { error, data } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    
    console.log('OTP verification result:', { error: error?.message, userEmail: data.user?.email, type });
    
    if (!error) {
      // Check if this is an invite (user needs to set password)
      if (type === 'invite' && data.user && !data.user.email_confirmed_at) {
        // Redirect to password setup with session tokens
        const session = data.session;
        if (session) {
          const redirectUrl = `/auth/set-password#access_token=${session.access_token}&refresh_token=${session.refresh_token}&type=invite`;
          redirect(redirectUrl);
        } else {
          redirect('/auth/set-password');
        }
      } else {
        // Regular email confirmation - redirect to home
        redirect('/home');
      }
    } else {
      // redirect the user to an error page with some instructions
      redirect(`/auth/error?error=${error?.message}`);
    }
  } else {
    // Missing token_hash or type - redirect to login
    console.log('Missing token_hash or type, redirecting to login');
    redirect('/auth/login');
  }

  // redirect the user to an error page with some instructions
  redirect(`/auth/error?error=No token hash or type`);
}
