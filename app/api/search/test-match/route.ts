import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = await createClient();

    // Try to fetch any existing embedding to avoid dimension mismatch
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

    const { data, error } = await supabase.rpc('match_chunks', {
      query_embedding: chunk.embedding as number[],
      match_count: 3,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (Array.isArray(data) ? data : []) as unknown[];
    return NextResponse.json({ ok: true, count: rows.length });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
