import { NextResponse } from 'next/server';
import { getUserById, getRecentLogs } from '../../../../lib/db';
import { getUserFromRequest } from '../../../../lib/auth';

export async function GET(request) {
  try {
    const auth = getUserFromRequest(request);
    if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const user = await getUserById(auth.userId);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const profile = typeof user.profile === 'string' ? JSON.parse(user.profile) : user.profile;
    let logs = {};
    let logsError = null;
    try {
      const rows = await getRecentLogs(Number(user.id), 14);
      rows.forEach(r => { logs[r.date] = typeof r.data === 'string' ? JSON.parse(r.data) : r.data; });
    } catch (logErr) {
      logsError = logErr.message;
      console.error('getRecentLogs failed:', logErr.message);
    }
    return NextResponse.json({ user: { id: Number(user.id), username: user.username, name: user.name, profile }, logs, logsError });
  } catch (e) { console.error('Me error:', e); return NextResponse.json({ error: 'Server error: ' + e.message }, { status: 500 }); }
}
