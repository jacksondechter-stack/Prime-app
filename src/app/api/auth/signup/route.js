import { NextResponse } from 'next/server';
import { getUserByUsername, createUser } from '../../../../lib/db';
import { signToken } from '../../../../lib/auth';
import bcrypt from 'bcryptjs';

export async function POST(request) {
  try {
    const { username, password, name, profile } = await request.json();
    if (!username || !password || !name) return NextResponse.json({ error: 'Username, password, and name required' }, { status: 400 });
    if (password.length < 6 || !/[A-Z]/.test(password)) return NextResponse.json({ error: 'Password: 6+ chars, 1 uppercase' }, { status: 400 });
    
    const existing = await getUserByUsername(username);
    if (existing) return NextResponse.json({ error: 'Username taken' }, { status: 409 });
    
    const hash = bcrypt.hashSync(password, 10);
    const result = await createUser(username.toLowerCase(), hash, name, profile || {});
    const token = signToken(result.lastInsertRowid, username.toLowerCase());
    
    const response = NextResponse.json({ success: true, token, user: { id: result.lastInsertRowid, username: username.toLowerCase(), name, profile: profile || {} } });
    response.cookies.set('prime_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 30*24*60*60, path: '/' });
    return response;
  } catch (e) { console.error('Signup error:', e); return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}
