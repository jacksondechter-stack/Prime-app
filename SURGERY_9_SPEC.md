# Surgery 9 — Local Notifications

**Branch:** `surgery-9-notifications`
**Rollback tag:** `pre-surgery-9` (commit 741bcaf)
**Target:** ship with Surgery 10 (HealthKit) in App Store v1.1.0 / build 17

---

## Phasing

- **9a:** plugin install, `notifications.js` library, `AppDelegate.swift` action category registration, `Info.plist` permission string, `Package.swift` updated via `npx cap sync ios`. NO hooks into page.js yet. Test in simulator manually firing notifications.
- **9b:** Settings UI — master toggle, sub-toggles, wake-time picker, "Mark today as rest day" button. State persists to localStorage. Behavior NOT wired yet.
- **9c:** Wire hooks into `sL()` in page.js. Every notification fires from its real trigger. Full end-to-end. (Tomorrow — not tonight.)

---

## Permission flow

- Permission requested **on first toggle-on** in Settings, NOT at app launch
  - Higher grant rate (user understands why they're being asked)
  - If user denies, Settings shows "Enable in iOS Settings" link with deep link to system settings
- If permission already granted, toggling off cancels all pending notifications but keeps permission alive
- If permission revoked in iOS Settings, app detects on next launch and shows banner: "Notifications turned off in iOS Settings"

---

## Settings storage schema

LocalStorage key: `calibr8_notif_prefs`

```json
{
  "enabled": true,
  "postWorkout": true,
  "mealChain": true,
  "workoutReminder": true,
  "morningRecap": true,
  "dayClose": true,
  "weightCheck": true,
  "streakMilestones": true,
  "calorieCeiling": true,
  "momentum": true,
  "wakeTime": "08:00",
  "restDayOverride": null
}
```

`restDayOverride` is a date string ("2026-06-25"). If set to today, all workout-related notifications suppressed for today. Cleared automatically at midnight.

---

## The 12 notifications

### Event-triggered (high-value)

**N1. Post-workout food reminder**
- Trigger: any exercise in any `wo*` array OR `myEx*` array marked `done:true`, AND day not yet closed
- Fire: 30 minutes after trigger
- Text: "Great Push day, Jackson — log your food to lock it in" (workout type from `woDay`, name from profile)
- Action: tap opens Eat tab
- ID format: `n1-postworkout-{YYYY-MM-DD}`
- Cancellation: cancelled if day closes before fire time; cancelled and re-scheduled if more `done:true` exercises added (push fire-time forward 30 min — debounce)
- **Midnight cap:** if fire time would be ≥23:00 local, fire at 23:00 instead. Never fire after midnight (message would refer to wrong day).
- Sub-toggle: `postWorkout`

**N2. Breakfast → Lunch chain**
- Trigger: `b` array (breakfast) gets first item added, AND no `l` items yet (fires regardless of rest day status — people eat on rest days)
- Fire: 4 hours after trigger, **capped at 15:00 local**. If trigger + 4h > 15:00, fire at 15:00. If trigger itself > 15:00, skip entirely (it's already past lunch).
- Text: "Crushed breakfast — what's lunch?"
- Action: tap opens Eat tab
- ID format: `n2-lunchchain-{YYYY-MM-DD}`
- Cancellation: cancelled if `l` (lunch) gets any items before fire time
- Sub-toggle: `mealChain`

**N3. Lunch → Workout reminder**
- Trigger: `l` array gets first item, AND today is a workout day per `woDay` rotation, AND no exercises marked `done:true`, AND no `restDayOverride`
- Fire: 4 hours after trigger, **capped at 20:00 local**. If trigger + 4h > 20:00, fire at 20:00. If trigger itself > 20:00, skip entirely.
- Text: "Hey Jackson — is today a rest day? If not, log your workout"
- Action buttons:
  - "Yes, rest day" → sets `restDayOverride` to today, cancels N3 and N6's workout half
  - tap body → opens Train tab
- ID format: `n3-workoutreminder-{YYYY-MM-DD}`
- Cancellation: cancelled if any exercise marked done, or rest-day override set
- Sub-toggle: `workoutReminder`

**N4. Morning recap (next day after close)**
- Trigger: day closes (`closed:true` set on today's log)
- Fire: tomorrow at user's wakeTime (default 08:00 local)
- Text: "Yesterday: B+. Let's beat it today" (grade pulled from yesterday's log)
- Action: tap opens Today tab
- ID format: `n4-recap-{YYYY-MM-DD-tomorrow}`
- Cancellation: replaced if day closes again same date (re-grade)
- Sub-toggle: `morningRecap`
- Personalization: name included if grade is A or B+

### Time-based fallbacks (only fire if user has gone silent)

**N5. Morning breakfast reminder (fallback)**
- Trigger: scheduled at app launch each day for **wakeTime + 2 hours** local (default 10:00 if wakeTime is 08:00)
- Fires only if at fire time: no `b` items AND no `wAM` AND no `closed:true`
- Text: "Morning Jackson — log breakfast to start the day"
- Action: tap opens Eat tab
- ID: `n5-morning-{YYYY-MM-DD}`
- Sub-toggle: `mealChain` (shares toggle since same loop)

**N6. Day-close reminder (fallback)**
- Trigger: scheduled at app launch each day for 20:00 local
- Fires only if at fire time: any logs exist AND `closed:false`
- Text: "Wrap your day — close out for your grade"
- Action: tap opens Stats tab
- ID: `n6-dayclose-{YYYY-MM-DD}`
- Sub-toggle: `dayClose`

**N7. Streak protection (fallback)**
- Trigger: scheduled at app launch each day for 11:30 local
- Fires only if at fire time: streak count ≥ 3 AND zero logs today
- Text: "Don't break your {N}-day streak"
- Action: tap opens Today tab
- ID: `n7-streak-{YYYY-MM-DD}`
- Sub-toggle: `streakMilestones`

### High-value bonus notifications

**N8. Weight check (every 2-3 days)**
- Trigger: scheduled at app launch for **wakeTime + 2 hours** local if `wAM` empty today AND `wAM` was last logged ≥ 2 days ago
- Text: "Morning weigh-in?"
- Action: tap opens Today tab (where weight entry lives)
- ID: `n8-weight-{YYYY-MM-DD}`
- Sub-toggle: `weightCheck`

**N9. Momentum protection (after strong grade)**
- Trigger: day closes with grade A or B+ AND previous day also A or B+
- Fire: next day at 19:00 local
- Text: "You're 2 days into something good. Stay sharp tonight."
- Action: tap opens Stats tab
- ID: `n9-momentum-{YYYY-MM-DD-tomorrow}`
- Sub-toggle: `momentum`

**N10. Streak milestone**
- Trigger: day closes and streak count hits 3, 7, 14, 30, 60, 90, or 100
- Fire: immediately (within 1 second)
- Text: "🔥 7-day streak. You're locked in."
- Action: tap opens Stats tab
- ID: `n10-milestone-{N}-{YYYY-MM-DD}`
- Sub-toggle: `streakMilestones`

**N11. Calorie ceiling warning**
- Trigger: food item logged that brings today's total > `calT + 200`
- Suppressed if profile indicates bulk/surplus (`gw > sw + 5` — gaining weight)
- **Max once per day** — once fired for a given date, subsequent overages on same date don't re-fire (state tracked in localStorage key `n11-lastFired`)
- Fire: immediately (within 1 second)
- Text: "That puts you 380 over target. Heads up."
- Action: tap opens Stats tab
- ID: `n11-ceiling-{timestamp}`
- Sub-toggle: `calorieCeiling`

**N12. Late workout catch (6pm catch-all)**
- Trigger: scheduled at app launch each workout day (per `woDay`) for 18:00 local
- Fires only if at fire time: today is workout day AND no exercises done AND no `restDayOverride`
- Text: "Train day. Want to push it back to tomorrow?"
- Action buttons:
  - "Mark rest" → sets `restDayOverride`
  - "I'll do it tonight" → snoozes for 2 hours, re-fires once
- ID: `n12-latewo-{YYYY-MM-DD}`
- Sub-toggle: `workoutReminder` (shares toggle since same intent)

---

## Streak counting rule

A day counts toward streak if its log has ANY of:
- Any food: `b`, `l`, `s`, `d` non-empty array
- Any completed exercise: any item in `woPush/woPull/woLegs/myEx*` with `done:true`
- Any weight: `wAM` or `wPM` numeric
- `closed:true`

Empty workout templates without `done:true` don't count.

Streak resets to 0 on first day without any of the above.

**Implementation:** function `getStreakCount(logs, todayDateStr)` in `notifications.js`. Walks backward from yesterday (NOT today — today's not done yet). For each prior date in sequence, checks if log object has any qualifying activity. Returns count at first non-qualifying day. Computed on demand, not stored — single source of truth is `logs`.

---

## Action category registration (AppDelegate.swift)

iOS requires action button categories registered at app launch. We add to `application(_:didFinishLaunchingWithOptions:)`:

```swift
let restDayAction = UNNotificationAction(
    identifier: "REST_DAY",
    title: "Yes, rest day",
    options: []
)
let markRestAction = UNNotificationAction(
    identifier: "MARK_REST",
    title: "Mark rest",
    options: []
)
let snoozeAction = UNNotificationAction(
    identifier: "SNOOZE_2H",
    title: "I'll do it tonight",
    options: []
)

let workoutReminderCategory = UNNotificationCategory(
    identifier: "WORKOUT_REMINDER",
    actions: [restDayAction],
    intentIdentifiers: [],
    options: []
)
let lateWorkoutCategory = UNNotificationCategory(
    identifier: "LATE_WORKOUT",
    actions: [markRestAction, snoozeAction],
    intentIdentifiers: [],
    options: []
)

UNUserNotificationCenter.current().setNotificationCategories([
    workoutReminderCategory,
    lateWorkoutCategory
])
```

Notifications with action buttons set `categoryId` matching these.

---

## Info.plist additions

**None required.** iOS local notifications use the built-in permission prompt; no `Usage Description` key needed (verified against Capacitor 8 docs and Apple's Cocoa Keys list). `Info.plist` is not touched in this surgery.

**Explicitly do NOT touch `UIRequiredDeviceCapabilities`.** The existing `armv7` value is technically incorrect (modern iOS is arm64-only) but Apple ignores it. The app has shipped working with it for months. Fixing it during the notifications surgery adds risk for zero benefit. Defer to a separate isolated change.

---

## Edge cases

- **Timezone change:** `wakeTime` interpreted as local time on each scheduling. Re-schedule on app foreground if locale changed.
- **App killed:** scheduled notifications persist in iOS — they fire regardless. On next launch, app calls `getPending()` to reconcile.
- **App deleted and reinstalled:** all pending notifications wiped by iOS. On first launch, app re-schedules based on current state.
- **Notifications disabled in iOS Settings:** detected on launch via `checkPermissions()`. Settings UI shows "Enable in iOS Settings" CTA. Toggles disabled.
- **Date rollover:** `restDayOverride` cleared on every app foreground event if its value !== today's date string. Specifically checked in app's `visibilitychange` listener and on initial load.
- **Multiple devices:** out of scope (Calibr8 is single-device per account currently).

---

## Test plan for Surgery 9a (simulator)

After 9a ships, before 9b, verify in Xcode simulator (iPhone 17):

1. Permission request fires only on first toggle (cold start, never granted) — verified by uninstalling and reinstalling
2. Pending notification appears in `getPending()` after `schedule()`
3. Notification fires at scheduled time (use 1-min delay for testing)
4. Tapping notification opens app (no crash)
5. Action button "Yes, rest day" returns action ID `REST_DAY` to handler
6. Cancellation via `cancel()` removes from pending list
7. No regression in existing app — body scan, food log, workout log all still work

If ANY of these fail in 9a, we do not proceed to 9b.

---

## Rollback plan

If anything breaks:
```bash
cd ~/calibr8-dev
git checkout main
git reset --hard pre-surgery-9
git push -f origin main  # only if 9a was already pushed; otherwise local-only revert
```

App returns to commit `741bcaf` (Surgery 16, last known good).

If a native bug ships to App Store before discovery: hotfix via web push doesn't help (native code only). Must submit emergency build with native code reverted.

---

## Open questions (none — all resolved this session)

- Notification count: 12 ✓
- Name personalization: emotionally-coded only (N1, N3, N5; conditional on N4) ✓
- Wake time default: 08:00 user-local ✓
- Streak definition: any meaningful activity ✓
- Phased ship: 9a → test → 9b → test → 9c (tomorrow) ✓
- App Store submission: bundle with Surgery 10, NOT before 9c lands ✓
