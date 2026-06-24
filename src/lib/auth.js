import jwt from 'jsonwebtoken';

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production-please';

export function signToken(userId, username) {
  return jwt.sign({ userId, username }, SECRET, { expiresIn: '30d' });
}

export function verifyToken(token) {
  try { return jwt.verify(token, SECRET); } catch (e) { return null; }
}

export function getUserFromRequest(request) {
  const auth = request.headers.get('authorization');
  let token = null;
  if (auth?.startsWith('Bearer ')) token = auth.slice(7);
  if (!token) {
    const cookie = request.headers.get('cookie');
    if (cookie) { const match = cookie.match(/prime_token=([^;]+)/); if (match) token = match[1]; }
  }
  if (!token) return null;
  return verifyToken(token);
}
