import { NextResponse } from 'next/server';
import { updateProfile } from '../../../../lib/db';
import { getUserFromRequest } from '../../../../lib/auth';

export async function POST(request) {
  try {
    const auth = getUserFromRequest(request);
    if (!auth) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    
    const { profile } = await request.json();
    if (!profile) return NextResponse.json({ error: 'Profile data required' }, { status: 400 });
    
    await updateProfile(auth.userId, profile);
    return NextResponse.json({ success: true });
  } catch (e) { console.error('Update profile error:', e); return NextResponse.json({ error: 'Server error' }, { status: 500 }); }
}
