import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function PATCH(req: NextRequest) {
  try {
    const { id, full_name, role_in_unit, weapon_serial, civilian_job, notes } = await req.json();

    if (!id || !full_name?.trim()) {
      return NextResponse.json({ error: 'id and full_name are required' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    const { error } = await supabase
      .from('soldiers')
      .update({
        full_name: full_name.trim(),
        role_in_unit: role_in_unit?.trim() || null,
        weapon_serial: weapon_serial?.trim() || null,
        civilian_job: civilian_job?.trim() || null,
        notes: notes?.trim() || null,
      } as never)
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 });
  }
}
