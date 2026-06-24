import { NextResponse } from 'next/server';
import { getLogs } from '../../../../lib/db';
import { getUserFromRequest } from '../../../../lib/auth';

export async function GET(request) {
  try {
    const auth = getUserFromRequest(request);
    if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    
    const rows = await getLogs(Number(auth.userId));
    const logs = {};
    rows.forEach(r => { logs[r.date] = typeof r.data === 'string' ? JSON.parse(r.data) : r.data; });
    
    return NextResponse.json({ logs });
  } catch (e) { console.error('Logs load error:', e); return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}
