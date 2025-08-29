import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();

    // Use any existing embedding to satisfy vector dimension
    const { data: chunk, error: embErr } = await supabase
      .from('chunks')
      .select('embedding, id')
      .not('embedding', 'is', null)
      .limit(1)
      .single();

    if (embErr || !chunk?.embedding) {
      return NextResponse.json(
        { error: 'No accessible embedding found in chunks (RLS may block).', details: embErr?.message },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc('hybrid_search', {
      query_embedding: chunk.embedding as number[],
      query_text: 'lithium',
      match_count: 3,
      text_weight: 0.3,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const count = Array.isArray(data) ? data.length : 0;
    return NextResponse.json({ ok: true, count });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
