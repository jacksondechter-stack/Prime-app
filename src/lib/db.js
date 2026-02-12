import { createClient } from '@libsql/client';

let _client = null;
let _initialized = false;

function getClient() {
  if (!_client) {
    _client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _client;
}

async function init() {
  if (_initialized) return;
  const c = getClient();
  await c.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      profile TEXT NOT NULL DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS daily_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, date)
    );
  `);
  _initialized = true;
}

export async function getUserByUsername(username) {
  await init();
  const r = await getClient().execute({ sql: 'SELECT * FROM users WHERE username = ?', args: [username.toLowerCase()] });
  return r.rows[0] || null;
}

export async function getUserById(id) {
  await init();
  const r = await getClient().execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] });
  return r.rows[0] || null;
}

export async function createUser(username, passwordHash, name, profile) {
  await init();
  const r = await getClient().execute({
    sql: 'INSERT INTO users (username, password_hash, name, profile) VALUES (?, ?, ?, ?)',
    args: [username.toLowerCase(), passwordHash, name, typeof profile === 'string' ? profile : JSON.stringify(profile)]
  });
  return { lastInsertRowid: Number(r.lastInsertRowid) };
}

export async function updateProfile(userId, profile) {
  await init();
  await getClient().execute({
    sql: 'UPDATE users SET profile = ? WHERE id = ?',
    args: [typeof profile === 'string' ? profile : JSON.stringify(profile), userId]
  });
}

export async function getLogs(userId) {
  await init();
  const r = await getClient().execute({ sql: 'SELECT date, data FROM daily_logs WHERE user_id = ? ORDER BY date', args: [userId] });
  return r.rows;
}

export async function upsertLog(userId, date, logData) {
  await init();
  const dataStr = typeof logData === 'string' ? logData : JSON.stringify(logData);
  await getClient().execute({
    sql: `INSERT INTO daily_logs (user_id, date, data, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(user_id, date) DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP`,
    args: [userId, date, dataStr]
  });
}
