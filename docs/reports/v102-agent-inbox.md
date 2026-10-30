# v102: agent inbox

Commit `d8a7ccb`: `v102: agent inbox (apply approved agentkit changes through the app's own code)`, pushed to `main`.

## What changed

**`index.html`**
- **`writeCompletion(refId, refType, plannedTime, opts = {})`**: new optional 4th parameter.
  - `opts.id` is used in place of `uuid()`.
  - `opts.at` is an ISO time that replaces "now" when computing `date`, `time_done`, `completed_at`, `time_bucket`, `day_of_week` and `minutes_from_planned`, all in local time. The same-day miss removal also uses that date.
  - Without opts, every value is computed exactly as before (`todayDate()`, `nowHHMM()`, `new Date()`, `uuid()`).
- **`applyInboxRow(row)`**: a synchronous validator and applier. It returns `{status, note, changed}`.
  - `add_item` pushes exactly the item sheet's create field set for that kind. `id` = `op_id` and `created_at` = `row.created_at`.
  - `check_block` sets `block.checks[date] = true` directly. It never calls a tap handler and never deletes.
  - `complete_item` calls `writeCompletion(it.id, 'item', it.time || null, { id: op_id, at: row.created_at })`. That matches the existing item call site.
  - All idempotency and reject rules follow the spec. Unknown ops are rejected.
- **`applyAgentInbox()`** steps:
  1. Guards on session, configuration, online state and `_inboxRunning`.
  2. Runs `GET /agent_inbox?status=eq.pending&order=created_at.asc&limit=50`.
  3. Applies each row, with a per-row try/catch so a thrown row is rejected as `apply error`.
  4. If any row changed state, it calls `saveState()`, `render()` and `toast('Applied N from your assistant')`.
  5. It then PATCHes each processed row with `{status, applied_at, note}`. A failed PATCH is logged and left for the next run.
  6. `finally` clears `_inboxRunning`.
- **Triggers:**
  - At the end of the `initialSync` success path.
  - On a new `visibilitychange` (visible) listener and a new `online` listener. Both go through one shared 10-second throttle.
  - The existing listeners are untouched.
- `APP_VERSION` is now `'v102'`.

**`sw.js`**: `VERSION` is now `'v102'`.

No `logAppEvent`/`logQueued`/`app_events` exists in this codebase, so there is nothing to log or avoid.

## Self-check

| # | Check | Result |
|---|---|---|
| 1 | `git diff --stat` touches only `index.html` and `sw.js` | **PASS**: `index.html \| 174 +++…`, `sw.js \| 2 +-`, 2 files changed |
| 2 | `writeCompletion` call sites other than the new one are unchanged | **PASS**: `grep -n "writeCompletion("` → `3380: writeCompletion(id, kind, ref.time \|\| null);`, `7861: writeCompletion(id, 'item', ref.time \|\| null);` (both untouched, 3 args → `opts = {}` → legacy path), `10630:` new call. A headless test confirmed that the legacy call still writes `date === todayDate()` with a fresh uuid. |
| 3 | No new key in the state shape | **PASS**: `git diff -U0 index.html \| grep "^+" \| grep -nE "state\.[A-Za-z_]+(\.[A-Za-z_]+)* *=[^=]\|meta\.[A-Za-z_]+ *=[^=]\|ensureTombstones\|tombstone\("` gives one hit only: `state.missed = state.missed.filter(...)` (the existing line in `writeCompletion`, now with `day`). The new code only reads `state.meta.tombstones` and pushes records with the item sheet's existing field sets. `seedState`, `ensureShape`, `mergeStates`, `MERGE_COLLECTIONS`, `SCHEMA_VERSION` and the tombstone helpers are unchanged. |
| 4 | Every early return and the error path leave `_inboxRunning` false | **PASS**: the first guard returns before the flag is set. After `_inboxRunning = true`, everything sits inside `try { … } finally { _inboxRunning = false; }`. That covers the fetch-error `return`, the empty-rows `return`, the normal end and the outer `catch`. The headless test confirmed `_inboxRunning === false`. |
| 5a | The same `add_item` on two devices gives one item | **PASS**: both devices push `{id: op_id, …}`. A second apply on the same device sees `state.items` with `id === op_id` and returns applied with no change. Across devices, `mergeStates` unions `items` by id. Test: `mergeStates(A, B)` gave 1 item with that id. |
| 5b | A `check_block` on a weekday that isn't due is rejected with a note | **PASS**: `isDueToday(b, date)` is false and the date isn't already checked, so the result is `rejected`, note `not due on YYYY-MM-DD`. Tested: `not due on 2026-10-29`. |
| 5c | A PATCH failure then a rerun marks the row applied with no duplicate | **PASS**: the failed PATCH is caught and logged, and the row stays `pending`. The next run re-fetches it. `add_item` finds the id already present, `check_block` finds `checks[date]` already true, and `complete_item` finds the existing completion. Each returns `applied` with `changed: false`, so there's no `saveState` or toast unless other rows changed, and the PATCH is retried. Idempotency tested for all three ops. |
| 5d | Signed out or offline does nothing | **PASS**: the first line returns when `!getSession() \|\| !supaConfigured() \|\| !navigator.onLine`. That's before the flag, any fetch or any state access. |
| 6 | The page loads with no console errors | **PASS (headless)**: the Chrome extension wasn't connected, so I loaded `http://localhost:8000` from `py -m http.server 8000` in headless Edge with console logging. The DOM rendered (`v102 · schema 17` in Settings). The only console lines were existing info/deprecation notices (password field not in a form, `apple-mobile-web-app-capable`), with no errors. |

## Extra verification

I ran a scratch copy of the page (port 8001, outside the repo) with 22 assertions against `applyInboxRow`, `writeCompletion` and `mergeStates`. **All 22 passed.** They covered:
- the to-do and event field sets
- timed event duration (90 min → 1.5)
- rejects: event with no date, bad priority, empty title, future date, older than 14 days, unknown op, completing an event, missing item
- the tombstoned add as an applied no-op
- the oldest allowed day (today − 14) applying
- `complete_item` fields derived from `created_at` in local time
- idempotency for each op
- the legacy `writeCompletion` path

## Notes

- **Toast wording:** it says "Applied N from your assistant" rather than "Added", because checks and completions count too.
- **Fetch filter:** it uses the spec path exactly, with no `user_id` filter. It relies on the `agent_inbox` RLS policy to limit rows to the signed-in user.
- **Timed events:** a timed event (`time` set) without a positive integer `duration_min` is rejected, which mirrors the item sheet's rule. An event with `time: null` is all-day with `duration: null`.
