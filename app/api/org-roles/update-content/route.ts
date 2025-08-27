import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  try {
    const { id, content_md } = await req.json()
    if (!id || typeof content_md !== 'string') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data, error } = await supabase
      .from('org_roles')
      .update({ content_md })
      .eq('id', id)
      .select('id,key,title,short_title,content_md')
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (!data) {
      // Either the row does not exist or RLS prevented returning it
      return NextResponse.json({ error: 'No row updated. Record not found or update blocked by RLS.' }, { status: 404 })
    }

    return NextResponse.json({ role: data }, { status: 200 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
