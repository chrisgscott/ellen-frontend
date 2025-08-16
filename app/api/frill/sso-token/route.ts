import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

// Small helper to create a signed HS256 JWT without extra deps
function base64url(input: Buffer | string) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signHS256(payload: Record<string, unknown>, secret: string) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const data = `${headerB64}.${payloadB64}`;
  const signature = crypto.createHmac('sha256', secret).update(data).digest('base64');
  const signatureB64 = signature.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${data}.${signatureB64}`;
}

export async function GET() {
  try {
    const secret = process.env.FRILL_SSO_SECRET;
    const frillKey = process.env.NEXT_PUBLIC_FRILL_KEY; // sanity check
    if (!secret) {
      return NextResponse.json({ error: 'FRILL_SSO_SECRET is not configured' }, { status: 500 });
    }
    if (!frillKey) {
      // Not strictly required, but helps catch misconfig
      return NextResponse.json({ error: 'NEXT_PUBLIC_FRILL_KEY is not configured' }, { status: 500 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = Math.floor(Date.now() / 1000);
    const exp = now + 10 * 60; // 10 minutes

    // Prefer name from profiles, then user_metadata, then email username
    let profileName: string | undefined;
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, name')
      .eq('id', user.id)
      .single();
    if (profile) {
      profileName = (profile as { full_name?: string; name?: string }).full_name || (profile as { full_name?: string; name?: string }).name || undefined;
    }
    const metadataName = (user.user_metadata?.full_name as string | undefined) || (user.user_metadata?.name as string | undefined) || undefined;
    const emailUsername = user.email.split('@')[0];
    const name = profileName || metadataName || emailUsername;

    const token = signHS256({
      email: user.email,
      id: String(user.id),
      name,
      iat: now,
      exp,
    }, secret);

    return NextResponse.json({ token }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Failed to create token' }, { status: 500 });
  }
}
