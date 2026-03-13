import { NextResponse } from 'next/server';
import { upsertLog } from '../../../../lib/db';
import { getUserFromRequest } from '../../../../lib/auth';

export async function POST(request) {
  try {
    const auth = getUserFromRequest(request);
    if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    
    const { date, data } = await request.json();
    if (!date) return NextResponse.json({ error: 'Date required' }, { status: 400 });
    
    await upsertLog(auth.userId, date, data || {});
    return NextResponse.json({ success: true });
  } catch (e) { console.error('Save log error:', e); return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}
