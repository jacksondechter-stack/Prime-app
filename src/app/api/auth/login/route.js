import { NextResponse } from 'next/server';
import { getUserByUsername, getLogs } from '../../../../lib/db';
import { signToken } from '../../../../lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    
    const user = await getUserByUsername(username);
    if (!user) return NextResponse.json({ error: 'No account found' }, { status: 404 });
    if (!bcrypt.compareSync(password, user.password_hash)) return NextResponse.json({ error: 'Wrong password' }, { status: 401 });
    
    const token = signToken(Number(user.id), user.username);
    const profile = typeof user.profile === 'string' ? JSON.parse(user.profile) : user.profile;
    const rows = await getLogs(Number(user.id));
    const logs = {};
    rows.forEach(r => { logs[r.date] = typeof r.data === 'string' ? JSON.parse(r.data) : r.data; });
    
    const response = NextResponse.json({ success: true, token, user: { id: Number(user.id), username: user.username, name: user.name, profile }, logs });
    response.cookies.set('prime_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 30*24*60*60, path: '/' });
    return response;
  } catch (e) { console.error('Login error:', e); return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}
