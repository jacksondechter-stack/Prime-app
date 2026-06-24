import { NextResponse } from "next/server";

const DB_URL = process.env.NEXT_PUBLIC_DB_URL || process.env.DB_URL;

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get("u");
    
    if (!username || username.length < 3) {
      return NextResponse.json({ available: false, error: "Username too short" });
    }

    const res = await fetch(`${DB_URL}/users/${encodeURIComponent(username)}.json`);
    const data = await res.json();
    
    return NextResponse.json({ available: data === null });
  } catch (e) {
    return NextResponse.json({ available: true }); // Default to available on error
  }
}
