let _token = typeof window !== 'undefined' ? localStorage.getItem('prime_token') : null;

export function setToken(t) {
  _token = t;
  if (typeof window !== 'undefined') {
    if (t) localStorage.setItem('prime_token', t);
    else localStorage.removeItem('prime_token');
  }
}

export function getToken() { return _token; }

async function api(path, body) {
  const opts = {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json' },
  };
  if (_token) opts.headers['Authorization'] = `Bearer ${_token}`;
  if (body) opts.body = JSON.stringify(body);
  
  const res = await fetch(path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export async function signup(username, password, name, profile) {
  const data = await api('/api/auth/signup', { username, password, name, profile });
  setToken(data.token);
  return data;
}

export async function login(username, password) {
  const data = await api('/api/auth/login', { username, password });
  setToken(data.token);
  return data;
}

export async function getMe() {
  return api('/api/auth/me');
}

export async function saveLog(date, dayData) {
  return api('/api/logs/save', { date, data: dayData });
}

export async function updateProfile(profile) {
  return api('/api/profile/update', { profile });
}

export function logout() {
  setToken(null);
  document.cookie = 'prime_token=; Max-Age=0; path=/';
}

// Debounced save - batches rapid changes
let _saveTimer = null;
export function debouncedSaveLog(date, dayData, delay = 1500) {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => saveLog(date, dayData), delay);
}
