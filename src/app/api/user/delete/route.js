import { NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { createClient } from '@libsql/client';

export async function DELETE(request) {
  try {
    const auth = await getUserFromRequest(request);
    if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    const userId = auth.userId;
    const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });


    try { await client.execute({ sql: 'DELETE FROM logs WHERE user_id = ?', args: [userId] }); } catch(e) {}
    try { await client.execute({ sql: 'DELETE FROM daily_logs WHERE user_id = ?', args: [userId] }); } catch(e) {}
    await client.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [userId] });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 });
  }}
