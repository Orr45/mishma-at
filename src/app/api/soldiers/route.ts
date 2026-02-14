import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Direct admin client - no cookies/auth needed
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function PATCH(req: NextRequest) {
  try {
    const { id, full_name, role_in_unit, weapon_serial, civilian_job, notes } = await req.json();

    if (!id || !full_name?.trim()) {
      return NextResponse.json({ error: 'id and full_name are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('soldiers')
      .update({
        full_name: full_name.trim(),
        role_in_unit: role_in_unit?.trim() || null,
        weapon_serial: weapon_serial?.trim() || null,
        civilian_job: civilian_job?.trim() || null,
        notes: notes?.trim() || null,
      })
      .eq('id', id)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'Soldier not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
