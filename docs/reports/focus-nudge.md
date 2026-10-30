# App events: opens, focus start/end, block check times

Commit `64fb08f`: `app events: log opens, focus start/end, and block check times to app_events`, pushed to `main`. `VERSION` and `APP_VERSION` are both now `'v102-events'`.

**`feed.html` does not exist in the repo, so I skipped the feed build.** No feed-page logging was added.

## What changed (index.html)

### Helpers
These sit in a new block after the v102 inbox listeners.

- **`logAppEvent(kind, fields = {})`**
  - POSTs `/app_events` through `supaFetch` with `Prefer: return=minimal`.
  - Body: `{kind, device, page: 'agenda', focus_start, ref, for_date}`, where `device` comes from `matchMedia('(pointer: coarse)')`. It sends no `user_id` and no `at`.
  - Returns a promise that resolves `true` on 2xx and `false` otherwise. That covers signed out, not configured, offline (no fetch is attempted) and errors.
  - Failures go to `console.warn` only. It never throws.
- **`noteOpen()`**
  - Logs at most one open per 5 minutes per page load (`_lastOpenLogged`). The clock only moves after a successful POST, so a failed open retries on the next trigger.
  - An in-flight guard stops simultaneous triggers (pageshow, focus and visibility firing together) from double-posting. Opens are never queued.
- **`logQueued(kind, fields)`**
  - Sends the event; on failure it goes into an in-memory `_eventQueue` capped at 50, which drops the oldest.
  - If older events are still queued, a new event joins the back of the line and a flush starts, so order holds.
  - It does nothing while signed out, so it never queues for later either.
- **`flushEventQueue()`**: sends the queue oldest first and stops at the first failure. A guard stops two flushes running at once.
- **`noteStartup()`**: runs once per page load. It calls `noteOpen()`, then `logQueued('focus_start', {focus_start: state.activeFocus.start})` if a session is running.

### Triggers
- **Startup:** `noteStartup()` is called at the end of the `initialSync` success path, and in a new `else` branch of the boot `if (getSession() && supaConfigured()) initialSync()`. That `else` branch is a no-op without a session or sync config.
- **Listeners:** I added calls to the existing listeners rather than registering duplicates.
  - The sync `visibilitychange` listener (when visible) now also calls `noteOpen(); flushEventQueue();`.
  - The sync `focus` listener now also calls `noteOpen()`.
  - The sync `online` listener now calls `noteOpen(); flushEventQueue();` as its first line, before its existing early returns.
  - There was no `pageshow` listener, so I added one.
- **Heartbeat:** one top-level `setInterval(…, 60s)`. It calls `noteOpen()` only when `document.visibilityState === 'visible' && document.hasFocus()`, and it always calls `flushEventQueue()`.

### Event sites
- **`startFocusSession`:** after `saveState()`, it calls `logQueued('focus_start', {focus_start: state.activeFocus.start})`.
- **`endFocusSession`:** after `saveState()`, it calls `logQueued('focus_end', {focus_start: af.start})`. `af` is captured before `activeFocus` is cleared, and the early return when nothing is active is unchanged.
- **`discardFocusSession`:** after the confirm, it captures `discardedStart`, clears, saves, then calls `logQueued('focus_end', …)`. The early return for no session and the confirm-cancel return both happen before any log.
- **`toggleBlockToday` (the only caller is the `toggle-block` tap) and `onPastDayClick` (the past-days sheet):**
  - Each records `wasChecked` before the toggle.
  - After `saveState()`, each calls `logQueued(wasChecked ? 'block_uncheck' : 'block_check', {ref: b.id, for_date: <key written>})`.
  - Both are true toggles, so the value always changes.
  - They are the only two tap paths that write `checks[date]`. The only other writer is `applyInboxRow` (line ~10628), which does not log.

## Self-check

| # | Check | Result |
|---|---|---|
| 1 | `git diff --stat` touches only `index.html`, `sw.js` (`feed.html` absent) | **PASS**: `index.html \| 119 ++++…--`, `sw.js \| 2 +-`, 2 files changed, 117 insertions(+), 4 deletions(-) |
| 2 | No new state key, localStorage key, or IndexedDB use | **PASS**: `git diff -U0 \| grep "^+" \| grep -nE "state\.[A-Za-z_]+(\.[A-Za-z_]+)* *=[^=>]\|meta\.[A-Za-z_]+ *=[^=]\|localStorage\|sessionStorage\|indexedDB\|IDB"` gives one hit only: the comment line `// stored in the state blob or localStorage; the retry queue is memory only.` No assignment to state, meta, storage or IDB was added. `mergeStates`, `MERGE_COLLECTIONS`, `ensureShape`, tombstones and `SCHEMA_VERSION` are untouched. The only removed lines are the two listener bodies that were extended. |
| 3a | Starting focus sends exactly one `focus_start` with `activeFocus.start` | **PASS**: one `logQueued` in `startFocusSession` after `saveState()`. Headless test: 1 event, `focus_start === state.activeFocus.start`, `ref` null, `page` `'agenda'`. |
| 3b | Ending and discarding each send one `focus_end` with the same start | **PASS**: tested both. End and discard with no active session send nothing. |
| 3c | A start while offline is queued and sent on `online` | **PASS**: offline, `logAppEvent` returns false without a fetch, and the event is queued. The `online` listener calls `flushEventQueue()`. Tested: queue 1 → 0 and the event was sent with the right start. |
| 3d | Hiding the app for 10 minutes then returning logs one open | **PASS**: visibility, focus and pageshow fired together and produced exactly one open. The in-flight guard plus the 5-minute throttle handle that. |
| 3e | A visible but unfocused tab logs no heartbeat opens | **PASS**: the heartbeat requires `document.hasFocus()`. Tested with virtual time: 61 s unfocused gave 0 opens, 61 s focused gave 1, and a further 3 minutes gave no more. |
| 3f | Signed out sends nothing | **PASS**: `logAppEvent`, `noteOpen` and `logQueued` all return early on `!getSession() \|\| !supaConfigured()`. Tested: a toggle, an open and a focus start while signed out gave 0 sent and 0 queued. |
| 3g | A failed POST never surfaces to the UI | **PASS**: the `supaFetch` rejection becomes `console.warn` and `false`, and every call site is fire-and-forget. Tested with a 503: no toast change, no throw, the check was still written, the event was queued, and a failed open did not advance the throttle. One existing caveat: `supaFetch` itself signs the user out when a token refresh fails on a 401. That is shared behavior that sync already has, not something new here. |
| 3h | Today check sends one `block_check` with today's key; uncheck sends one `block_uncheck`; a past-days fix sends yesterday's key | **PASS**: all three tested. |
| 3i | A check applied by `applyAgentInbox` or arriving through sync sends nothing | **PASS**: `applyInboxRow` sets `checks[date]` directly, and `mergeStates`/`mergeBlockPair` never call the tap handlers. Tested: an inbox check plus a merge sent 0 events. |
| 4 | The heartbeat is registered once | **PASS**: one top-level `setInterval` that is not inside any function. `grep -n "setInterval("` shows only it plus the existing focus timer, sync status and morning popup intervals. Sign-in reaches `noteStartup` through `initialSync`, which is guarded by `_startupNoted`. |
| 5 | The page loads with no console errors | **PASS (headless)**: the Chrome extension wasn't connected, so I loaded `http://localhost:8000` (`py -m http.server 8000`) in headless Edge. It rendered `v102-events · schema 17`. The console showed only the existing info notices (password field not in a form, `apple-mobile-web-app-capable`). |

**Extra:** 18 assertions ran headless against a scratch copy (port 8001, outside the repo) with `supaFetch`/`getSession` stubbed and virtual time. **All passed**, including the 50-event queue cap dropping the oldest.

## Read-only finding 1: `activeFocus` across devices

`activeFocus` is not in `MERGE_COLLECTIONS` or `SCALAR_MERGES`. It is a whole-blob scalar, so **the side with the newer `meta.updated_at` wins outright**:

```js
// index.html:10116-10120 (mergeStates)
const remoteIsNewer = remoteAt > localAt;
const newer = remoteIsNewer ? remoteState : localState;
// Base merged blob on the newer side so scalars/singletons come from it.
const merged = JSON.parse(JSON.stringify(newer));
```

Compare `focusLastType`, which does get per-field timestamps (`index.html:10090`: `{ get: s => s, field: 'focusLastType', at: 'focusLastTypeAt' }`). `activeFocus` has nothing like that.

**Yes, the computer can clear a running phone session:**
1. The phone starts a session at T1 and pushes.
2. The computer, without having pulled since, saves anything at T2 > T1. `saveState` stamps `state.meta.updated_at = nowIso()` (`:1525`).
3. `_doPush` uploads the computer's whole blob (`supaPush(state)` upserts the row), with `activeFocus: null` and a newer `updated_at`. The cloud now says no session.
4. When the phone next pulls (`pullOnReturn`), the remote is newer, so the merged `activeFocus` is `null`. The running session disappears from the phone with no `focusSessions` record.

It works the other way too: if the phone's blob is newer, a computer pull adopts the phone's `activeFocus`, and the computer's focus button then opens the overlay (`:2276`, `if (state.activeFocus) openFocusOverlay();`).

**Effect on the nudge job:** the `app_events` focus rows come from taps, not the blob, so they are unaffected. A session cleared this way, however, never sends a `focus_end`. The job should cap how long it trusts an unmatched `focus_start`.

## Read-only finding 2: block types other than checkbox

Blocks are created in `index.html:9526-9534`. Each type's per-day storage, and how a merge combines it (`mergeBlockPair`, `:9987+`):

| Type | Created | Per-day / value storage | Written by | Merge |
|---|---|---|---|---|
| `counter` | `:9526` `{ type: 'counter', unit, entries: [] }` | `entries: [{date, value}]`, one per day. Same-day entries are overwritten, and it only ever writes today. | `saveCounterLog` `:9665-9667`: `b.entries = b.entries.filter(e => e.date !== date); b.entries.push({ date, value: Math.round(v * 100) / 100 });` with `date = todayDate()` | Union by date, newer side wins per date (`:10006`) |
| `cycle` | `:9528` `{ type: 'cycle', count: 0, markers: [], history: [] }` | A running `count`, plus `history: [{date, count}]` appended per increment. | `cycleIncrement` `:9722-9724` (`b.count = (b.count \| 0) + 1; … b.history.push({ date: todayDate(), count: b.count });`). `cycleDecrement` `:9734` (`b.count - 1`, `history.pop()`). Markers: `:9785` `b.markers.push({ id: uuid(), n, note })`. | `count` takes the max; `history` is a union deduped on date+count (`:10012`) |
| `goal` | `:9532` `{ type: 'goal', target, current, unit, note }` | A single `current` total with **no per-day record**. Daily deltas are not kept. | `saveGoalProgress` `:9709`: `b.current = Math.max(0, Math.round((cur + delta) * 100) / 100);` (also edited via the block form) | `current` takes the max (`:10026`) |
| `notes` | `:9534` `{ type: 'notes', text }` | Free `text` with no per-day value. | Block form edit (`Object.assign(b, { label, text: f.text \|\| '' })`) | Newer whole record |

**Side note for the pattern finder:** checkbox merge favors checked (`:9998`, a union of truthy keys). An uncheck on one device can be brought back by a merge with the other device's older blob. A `block_uncheck` row can therefore exist for a day the blob still shows as checked.
