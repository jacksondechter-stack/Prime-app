// src/lib/notifications.js
// Calibr8 notifications library — Surgery 9a foundation
// All 12 notification types, scheduling, cancellation, permissions, streak counter.
// NO hooks into page.js yet — that's 9c.

import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

// ============================================================================
// CONSTANTS
// ============================================================================

const PREFS_KEY = 'calibr8_notif_prefs';
const N11_LAST_FIRED_KEY = 'n11-lastFired'; // YYYY-MM-DD of last calorie ceiling fire

const DEFAULT_PREFS = {
  enabled: false, // false until user enables in Settings (and grants iOS permission)
  postWorkout: true,
  mealChain: true,
  workoutReminder: true,
  morningRecap: true,
  dayClose: true,
  weightCheck: true,
  streakMilestones: true,
  calorieCeiling: true,
  momentum: true,
  wakeTime: '08:00',
  restDayOverride: null, // YYYY-MM-DD string when set
};

// Stable numeric IDs per spec. Each ID stable per type per date (or per type for streak milestones)
// so cancellation/replacement works deterministically.
// Format: prefix * 100000 + dateHash
// Prefixes: N1=1, N2=2, N3=3, N4=4, N5=5, N6=6, N7=7, N8=8, N9=9, N10=10, N11=11, N12=12
function dateHash(dateStr) {
  // YYYY-MM-DD → numeric hash YYYYMMDD
  return parseInt(dateStr.replace(/-/g, ''), 10);
}
function nid(prefix, dateStr, extra = 0) {
  // extra used for N10 (streak milestone — encodes streak count)
  return prefix * 100000000 + dateHash(dateStr) + extra;
}

// ============================================================================
// PLATFORM CHECK
// ============================================================================

function isNative() {
  return Capacitor.isNativePlatform();
}

// ============================================================================
// PREFERENCES
// ============================================================================

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...DEFAULT_PREFS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_PREFS };
  }
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn('Failed to save notif prefs:', e);
  }
}

export function updatePrefs(patch) {
  const current = loadPrefs();
  const updated = { ...current, ...patch };
  savePrefs(updated);
  return updated;
}

// ============================================================================
// REST DAY OVERRIDE — cleared on foreground if stale
// ============================================================================

export function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function clearStaleRestDay() {
  const prefs = loadPrefs();
  if (prefs.restDayOverride && prefs.restDayOverride !== todayStr()) {
    updatePrefs({ restDayOverride: null });
  }
}

export function isRestDay() {
  const prefs = loadPrefs();
  clearStaleRestDay();
  return loadPrefs().restDayOverride === todayStr();
}

export function setRestDay() {
  updatePrefs({ restDayOverride: todayStr() });
  // Cancel today's workout-related notifications
  return cancelByIds([nid(3, todayStr()), nid(12, todayStr())]);
}

// ============================================================================
// PERMISSIONS
// ============================================================================

export async function checkPerm() {
  if (!isNative()) return { display: 'web-stub' };
  try {
    return await LocalNotifications.checkPermissions();
  } catch (e) {
    console.warn('checkPerm failed:', e);
    return { display: 'unknown' };
  }
}

export async function requestPerm() {
  if (!isNative()) return { display: 'web-stub' };
  try {
    const result = await LocalNotifications.requestPermissions();
    return result;
  } catch (e) {
    console.warn('requestPerm failed:', e);
    return { display: 'denied' };
  }
}

export async function hasPerm() {
  const r = await checkPerm();
  return r.display === 'granted';
}

// ============================================================================
// ACTION CATEGORIES — register on first init
// ============================================================================

let _actionsRegistered = false;

export async function registerActions() {
  if (_actionsRegistered || !isNative()) return;
  try {
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: 'WORKOUT_REMINDER',
          actions: [
            { id: 'REST_DAY', title: 'Yes, rest day' },
          ],
        },
        {
          id: 'LATE_WORKOUT',
          actions: [
            { id: 'MARK_REST', title: 'Mark rest' },
            { id: 'SNOOZE_2H', title: "I'll do it tonight" },
          ],
        },
      ],
    });
    _actionsRegistered = true;
  } catch (e) {
    console.warn('registerActions failed:', e);
  }
}

// ============================================================================
// CORE SCHEDULE / CANCEL
// ============================================================================

async function _schedule(notif) {
  if (!isNative()) return { stub: true };
  try {
    await registerActions();
    return await LocalNotifications.schedule({ notifications: [notif] });
  } catch (e) {
    console.warn('schedule failed:', e, notif);
    return null;
  }
}

export async function cancelByIds(ids) {
  if (!isNative() || !ids.length) return;
  try {
    await LocalNotifications.cancel({
      notifications: ids.map(id => ({ id })),
    });
  } catch (e) {
    console.warn('cancel failed:', e);
  }
}

export async function cancelAll() {
  if (!isNative()) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications && pending.notifications.length) {
      await LocalNotifications.cancel({ notifications: pending.notifications });
    }
  } catch (e) {
    console.warn('cancelAll failed:', e);
  }
}

export async function getPending() {
  if (!isNative()) return { notifications: [] };
  try {
    return await LocalNotifications.getPending();
  } catch (e) {
    console.warn('getPending failed:', e);
    return { notifications: [] };
  }
}

// ============================================================================
// TIME HELPERS
// ============================================================================

function todayAt(hour, minute = 0) {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

function tomorrowAt(hour, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function addMinutes(date, minutes) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function parseHHMM(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return { hour: h || 0, minute: m || 0 };
}

// Cap a Date to a max time-of-day TODAY. If date > today's cap, return today's cap.
// If trigger date itself is already past cap, return null (skip).
function capAt(date, capHour, capMinute = 0) {
  const cap = todayAt(capHour, capMinute);
  if (date.getTime() > cap.getTime()) return cap;
  return date;
}

// ============================================================================
// STREAK COUNTER
// ============================================================================

// Returns true if a log object has any qualifying activity (food, completed
// workout, weight, or closed).
function isStreakDay(log) {
  if (!log) return false;
  if (log.closed === true) return true;
  if (typeof log.wAM === 'number' || typeof log.wPM === 'number') return true;
  for (const k of ['b', 'l', 's', 'd']) {
    if (Array.isArray(log[k]) && log[k].length > 0) return true;
  }
  for (const k of ['woPush', 'woPull', 'woLegs', 'myEx', 'myExPush', 'myExPull', 'myExLegs']) {
    const arr = log[k];
    if (Array.isArray(arr)) {
      for (const ex of arr) {
        if (ex && ex.done === true) return true;
        // Some exercises track per-set logs (n-array shape)
        if (ex && Array.isArray(ex.log)) {
          for (const set of ex.log) {
            if (set && (set.w || set.r) && set.w !== '' && set.r !== '') return true;
          }
        }
      }
    }
  }
  return false;
}

// Walk backward from yesterday counting consecutive qualifying days.
// Today excluded — today's not done yet, so it doesn't count toward streak.
export function getStreakCount(logs, todayDateStr = todayStr()) {
  if (!logs || typeof logs !== 'object') return 0;
  let count = 0;
  const cursor = new Date(todayDateStr + 'T00:00:00');
  cursor.setDate(cursor.getDate() - 1); // start at yesterday
  // Walk up to 365 days backward; safety cap
  for (let i = 0; i < 365; i++) {
    const y = cursor.getFullYear();
    const m = String(cursor.getMonth() + 1).padStart(2, '0');
    const d = String(cursor.getDate()).padStart(2, '0');
    const key = `${y}-${m}-${d}`;
    if (isStreakDay(logs[key])) {
      count++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return count;
}

// ============================================================================
// THE 12 NOTIFICATIONS
// ============================================================================

// Each is a separate function. None of these are hooked yet — page.js calls
// them from 9c. For 9a they exist and can be invoked manually for testing.

const today = () => todayStr();
const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// N1 — Post-workout food reminder (30 min after exercise marked done)
// `workoutType` is "Push" | "Pull" | "Legs" | "Custom"
// `firstName` is profile.name
export async function scheduleN1PostWorkout(workoutType = 'Push', firstName = '') {
  const prefs = loadPrefs();
  if (!prefs.enabled || !prefs.postWorkout) return;
  const dateStr = today();
  const id = nid(1, dateStr);
  // Cancel any pending N1 for today (debounce — re-schedule on new done:true)
  await cancelByIds([id]);
  const fire = capAt(addMinutes(new Date(), 30), 23, 0); // never past 23:00 today
  // If the original 30-min fire would land tomorrow, fire at 23:00 today instead
  if (fire.getTime() <= Date.now()) return; // safety; nothing to schedule
  const name = firstName ? `, ${firstName}` : '';
  await _schedule({
    id,
    title: 'Calibr8',
    body: `Great ${workoutType} day${name} — log your food to lock it in`,
    schedule: { at: fire },
  });
}

// N2 — Breakfast → Lunch chain (4hr after breakfast, capped at 15:00)
export async function scheduleN2LunchChain() {
  const prefs = loadPrefs();
  if (!prefs.enabled || !prefs.mealChain) return;
  const now = new Date();
  // Skip if already past lunch cap
  if (now.getHours() >= 15) return;
  const fire = capAt(addMinutes(now, 240), 15, 0);
  const dateStr = today();
  const id = nid(2, dateStr);
  await cancelByIds([id]);
  await _schedule({
    id,
    title: 'Calibr8',
    body: "Crushed breakfast — what's lunch?",
    schedule: { at: fire },
  });
}

// N3 — Lunch → Workout reminder (4hr after lunch, capped at 20:00)
export async function scheduleN3WorkoutReminder(firstName = '') {
  const prefs = loadPrefs();
  if (!prefs.enabled || !prefs.workoutReminder) return;
  if (isRestDay()) return;
  const now = new Date();
  if (now.getHours() >= 20) return;
  const fire = capAt(addMinutes(now, 240), 20, 0);
  const dateStr = today();
  const id = nid(3, dateStr);
  await cancelByIds([id]);
  const name = firstName || 'there';
  await _schedule({
    id,
    title: 'Calibr8',
    body: `Hey ${name} — is today a rest day? If not, log your workout`,
    schedule: { at: fire },
    actionTypeId: 'WORKOUT_REMINDER',
  });
}

// N4 — Morning recap (tomorrow at wakeTime, includes yesterday's grade)
// Call from day-close handler. grade is the closed day's grade letter.
export async function scheduleN4MorningRecap(grade, firstName = '') {
  const prefs = loadPrefs();
  if (!prefs.enabled || !prefs.morningRecap) return;
  const { hour, minute } = parseHHMM(prefs.wakeTime || '08:00');
  const fire = tomorrowAt(hour, minute);
  const tomorrowStr = tomorrow();
  const id = nid(4, tomorrowStr);
  await cancelByIds([id]); // replace if re-grading
  const goodGrade = grade === 'A' || grade === 'B+' || grade === 'A+' || grade === 'A-' || grade === 'B';
  const name = goodGrade && firstName ? `, ${firstName}` : '';
  await _schedule({
    id,
    title: 'Calibr8',
    body: `Yesterday: ${grade}${name}. Let's beat it today`,
    schedule: { at: fire },
  });
}

// N5 — Morning breakfast fallback (wakeTime + 2hr if nothing logged)
// Scheduled at app launch. Fire condition re-checked at notification time
// is impossible in iOS local notif — so we just don't schedule if condition
// is already false at scheduling, AND cancel from page.js if user logs before fire.
export async function scheduleN5Morning(firstName = '') {
  const prefs = loadPrefs();
  if (!prefs.enabled || !prefs.mealChain) return;
  const { hour, minute } = parseHHMM(prefs.wakeTime || '08:00');
  // wakeTime + 2 hours
  let fireHour = hour + 2;
  let fireMinute = minute;
  if (fireHour >= 24) fireHour = 23, fireMinute = 30;
  const fire = todayAt(fireHour, fireMinute);
  if (fire.getTime() <= Date.now()) return; // already past
  const dateStr = today();
  const id = nid(5, dateStr);
  await cancelByIds([id]);
  const name = firstName ? `, ${firstName}` : '';
  await _schedule({
    id,
    title: 'Calibr8',
    body: `Morning${name} — log breakfast to start the day`,
    schedule: { at: fire },
  });
}

// N6 — Day-close fallback (20:00 local if not closed)
export async function scheduleN6DayClose() {
  const prefs = loadPrefs();
  if (!prefs.enabled || !prefs.dayClose) return;
  const fire = todayAt(20, 0);
  if (fire.getTime() <= Date.now()) return;
  const dateStr = today();
  const id = nid(6, dateStr);
  await cancelByIds([id]);
  await _schedule({
    id,
    title: 'Calibr8',
    body: 'Wrap your day — close out for your grade',
    schedule: { at: fire },
  });
}

// N7 — Streak protection (11:30 if streak ≥ 3 AND nothing logged today)
export async function scheduleN7Streak(streakCount) {
  const prefs = loadPrefs();
  if (!prefs.enabled || !prefs.streakMilestones) return;
  if (streakCount < 3) return;
  const fire = todayAt(11, 30);
  if (fire.getTime() <= Date.now()) return;
  const dateStr = today();
  const id = nid(7, dateStr);
  await cancelByIds([id]);
  await _schedule({
    id,
    title: 'Calibr8',
    body: `Don't break your ${streakCount}-day streak`,
    schedule: { at: fire },
  });
}

// N8 — Weight check (wakeTime + 2hr if wAM empty AND ≥2 days since last weight)
// `daysSinceWeight` computed by caller from logs
export async function scheduleN8WeightCheck(daysSinceWeight) {
  const prefs = loadPrefs();
  if (!prefs.enabled || !prefs.weightCheck) return;
  if (daysSinceWeight < 2) return;
  const { hour, minute } = parseHHMM(prefs.wakeTime || '08:00');
  let fireHour = hour + 2;
  let fireMinute = minute;
  if (fireHour >= 24) fireHour = 23, fireMinute = 30;
  const fire = todayAt(fireHour, fireMinute);
  if (fire.getTime() <= Date.now()) return;
  const dateStr = today();
  const id = nid(8, dateStr);
  await cancelByIds([id]);
  await _schedule({
    id,
    title: 'Calibr8',
    body: 'Morning weigh-in?',
    schedule: { at: fire },
  });
}

// N9 — Momentum (next day 19:00, only if 2+ days of good grades)
export async function scheduleN9Momentum() {
  const prefs = loadPrefs();
  if (!prefs.enabled || !prefs.momentum) return;
  const fire = tomorrowAt(19, 0);
  const tomorrowStr = tomorrow();
  const id = nid(9, tomorrowStr);
  await cancelByIds([id]);
  await _schedule({
    id,
    title: 'Calibr8',
    body: "You're 2 days into something good. Stay sharp tonight.",
    schedule: { at: fire },
  });
}

// N10 — Streak milestone (immediate, at 3/7/14/30/60/90/100)
export async function fireN10Milestone(streakCount) {
  const prefs = loadPrefs();
  if (!prefs.enabled || !prefs.streakMilestones) return;
  const milestones = [3, 7, 14, 30, 60, 90, 100];
  if (!milestones.includes(streakCount)) return;
  const dateStr = today();
  const id = nid(10, dateStr, streakCount); // extra = streak count for uniqueness
  // Fire ~2 seconds out so it appears after day-close UI clears
  const fire = new Date(Date.now() + 2000);
  await _schedule({
    id,
    title: 'Calibr8',
    body: `🔥 ${streakCount}-day streak. You're locked in.`,
    schedule: { at: fire },
  });
}

// N11 — Calorie ceiling (immediate, max once per day)
// `overBy` = how many calories over the target including the new item
export async function fireN11Ceiling(overBy, isBulking) {
  const prefs = loadPrefs();
  if (!prefs.enabled || !prefs.calorieCeiling) return;
  if (isBulking) return; // suppress for bulkers
  if (overBy < 200) return;
  // Once per day
  const lastFired = localStorage.getItem(N11_LAST_FIRED_KEY);
  const dateStr = today();
  if (lastFired === dateStr) return;
  try {
    localStorage.setItem(N11_LAST_FIRED_KEY, dateStr);
  } catch {}
  const id = nid(11, dateStr);
  const fire = new Date(Date.now() + 1000);
  await _schedule({
    id,
    title: 'Calibr8',
    body: `That puts you ${overBy} over target. Heads up.`,
    schedule: { at: fire },
  });
}

// N12 — Late workout catch (18:00 on workout days)
export async function scheduleN12LateWorkout() {
  const prefs = loadPrefs();
  if (!prefs.enabled || !prefs.workoutReminder) return;
  if (isRestDay()) return;
  const fire = todayAt(18, 0);
  if (fire.getTime() <= Date.now()) return;
  const dateStr = today();
  const id = nid(12, dateStr);
  await cancelByIds([id]);
  await _schedule({
    id,
    title: 'Calibr8',
    body: 'Train day. Want to push it back to tomorrow?',
    schedule: { at: fire },
    actionTypeId: 'LATE_WORKOUT',
  });
}

// ============================================================================
// TEST HELPERS (for Surgery 9a manual testing in simulator)
// ============================================================================

// Fire a notification in 10 seconds — used to verify the plugin works.
export async function fireTestIn10s() {
  if (!isNative()) {
    console.log('fireTestIn10s: not native, skipping');
    return;
  }
  await registerActions();
  const fire = new Date(Date.now() + 10000);
  await _schedule({
    id: 999999,
    title: 'Calibr8 test',
    body: 'If you see this, notifications work.',
    schedule: { at: fire },
  });
  console.log('Test notification scheduled for 10 seconds from now');
}

// Print everything in the queue.
export async function debugPending() {
  const p = await getPending();
  console.log('Pending notifications:', p);
  return p;
}

// ============================================================================
// ACTION LISTENER — receives taps and action button responses
// ============================================================================

let _actionListenerRegistered = false;

export function registerActionListener(onAction) {
  if (_actionListenerRegistered || !isNative()) return;
  _actionListenerRegistered = true;
  LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
    // event.actionId = "tap" | "REST_DAY" | "MARK_REST" | "SNOOZE_2H"
    // event.notification = the scheduled notification object
    try {
      onAction(event);
    } catch (e) {
      console.warn('action handler threw:', e);
    }
  });
}
