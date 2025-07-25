import { createClient } from "@/lib/supabase/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  let next = searchParams.get("next") ?? "/home";

  if (token_hash && type) {
    const supabase = await createClient();

    const { error, data } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });
    if (!error && data.user) {
      // Check if this is an invite - user was just created
      const now = new Date();
      const userCreated = new Date(data.user.created_at);
      const isRecentlyCreated = (now.getTime() - userCreated.getTime()) < (10 * 60 * 1000); // 10 minutes
      
      // If user was just created (invite), send to password setup
      if (isRecentlyCreated && type === 'invite') {
        next = '/auth/set-password';
      }
      
      // redirect user to specified redirect URL or determined page
      redirect(next);
    } else {
      // redirect the user to an error page with some instructions
      redirect(`/auth/error?error=${error?.message}`);
    }
  }

  // redirect the user to an error page with some instructions
  redirect(`/auth/error?error=No token hash or type`);
}
