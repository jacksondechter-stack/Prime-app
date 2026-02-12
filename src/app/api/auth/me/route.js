import { NextResponse } from 'next/server';
import { getUserById, getLogs } from '../../../../lib/db';
import { getUserFromRequest } from '../../../../lib/auth';

export async function GET(request) {
  try {
    const auth = getUserFromRequest(request);
    if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    
    const user = await getUserById(auth.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    
    const profile = typeof user.profile === 'string' ? JSON.parse(user.profile) : user.profile;
    const rows = await getLogs(Number(user.id));
    const logs = {};
    rows.forEach(r => { logs[r.date] = typeof r.data === 'string' ? JSON.parse(r.data) : r.data; });
    
    return NextResponse.json({ user: { id: Number(user.id), username: user.username, name: user.name, profile }, logs });
  } catch (e) { console.error('Me error:', e); return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}
