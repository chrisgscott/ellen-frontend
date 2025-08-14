import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const url: unknown = body?.url;

    if (typeof url !== 'string' || url.trim().length === 0) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Basic URL validation
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 400 });
    }

    const webhookUrl = process.env.N8N_NEWS_WEBHOOK_URL;
    if (!webhookUrl) {
      console.error('N8N_NEWS_WEBHOOK_URL is not configured');
      return NextResponse.json({ error: 'Service not configured' }, { status: 500 });
    }

    const payload = {
      url,
      userId: user.id,
      source: 'ellen-dashboard',
      submittedAt: new Date().toISOString(),
    };

    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const text = await resp.text().catch(() => '');

    if (!resp.ok) {
      console.error('n8n webhook error', resp.status, text);
      return NextResponse.json(
        { ok: false, status: resp.status, error: 'Failed to forward to processor', message: text },
        { status: 502 },
      );
    }

    return NextResponse.json({ ok: true, status: resp.status, message: text });
  } catch (err) {
    console.error('submit-link POST error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
