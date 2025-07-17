import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export async function GET() {
  // Use service role client to bypass RLS for server-side operations
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );

  console.log('🔧 OPPORTUNITIES API: Starting query...', new Date().toISOString());

  // First, get the basic opportunity data
  const { data: alertsData, error: alertsError } = await supabase
    .from('litore_alerts')
    .select(`
      id,
      title,
      description,
      recommended_action,
      potential_impact_usd,
      material_id
    `)
    .eq('alert_type', 'new_opportunity')
    .gt('potential_impact_usd', 500000000);

  if (alertsError) {
    console.error('🔧 OPPORTUNITIES API: Error fetching alerts:', alertsError);
    return NextResponse.json({ error: 'Failed to fetch opportunities' }, { status: 500 });
  }

  console.log('🔧 OPPORTUNITIES API: Found alerts:', alertsData?.length || 0);

  if (!alertsData || alertsData.length === 0) {
    return NextResponse.json([]);
  }

  // Get material names for each opportunity
  const opportunities = [];
  for (const alert of alertsData) {
    let materialName = 'N/A';
    
    if (alert.material_id) {
      const { data: materialData } = await supabase
        .from('materials')
        .select('material')
        .eq('id', alert.material_id)
        .single();
      
      materialName = materialData?.material || 'N/A';
    }

    opportunities.push({
      title: alert.title,
      description: alert.description,
      recommended_action: alert.recommended_action,
      potential_impact_usd: alert.potential_impact_usd,
      materials: materialName,
    });
  }

  console.log('🔧 OPPORTUNITIES API: Returning opportunities:', opportunities.length);
  return NextResponse.json(opportunities);
}
