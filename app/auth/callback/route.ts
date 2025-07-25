import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  let next = searchParams.get('next') ?? '/home'

  if (code) {
    const supabase = await createClient()
    const { error, data } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      // Check if this is an invite flow - invited users typically have email_confirmed_at but no password
      // or check if the user was created very recently (within last few minutes)
      const now = new Date();
      const userCreated = new Date(data.user.created_at);
      const isRecentlyCreated = (now.getTime() - userCreated.getTime()) < (5 * 60 * 1000); // 5 minutes
      
      // If user was just created (invite) and email is confirmed, send to password setup
      if (isRecentlyCreated && data.user.email_confirmed_at) {
        next = '/auth/set-password';
      }
      const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}
