# v104: agent control report

Commit `63a5f09` "v104: the assistant can edit, delete, uncheck, and fix things (all approved first)", pushed to `main` (Render deploys it). Only `index.html` (+262 / −4) and `sw.js` (1 line) changed.

## What changed

**`applyInboxRow` has ten new kinds of change.** Every branch checks the whole payload before it touches state, so a rejected row changes nothing. Each one makes the same change as the matching in-app action, with no dialog, no toast, and no event log:

| Kind | Mirrors | Already-done note |
|---|---|---|
| `edit_item` | `saveForm`'s edit branch (`Object.assign` of only the fields that changed) | `already so` |
| `delete_item` | `deleteCurrent`'s item branch (`tombstone('items')` + filter) | `already deleted` |
| `uncomplete_item` | `undoCompletion`, for every date (`tombstoneAll('completions')` + filter) | `already not done` |
| `uncheck_block` | `onPastDayClick` / `toggleBlockToday` (`delete b.checks[date]`) | `already unchecked` |
| `add_block` | `saveBlockForm`'s create branch (id = `op_id`, createdAt = `row.created_at`, order = max + 1) | `already present` / `deleted in app` |
| `edit_block` | `saveBlockForm`'s edit branch, with the fields allowed for each block type | `already so` |
| `delete_block` | `deleteBlockById` (tombstone, filter, `renumberOrder`) | `already deleted` |
| `log_counter` | `saveCounterLog` for the given date (drop that day's entry, push, sort; value rounded to 2 places) | `already so` |
| `delete_focus_session` | `deleteFocusSession` (tombstone + filter; clears `focusSelectedSession` if it was this session; `activeFocus` untouched) | `already deleted` |
| `set_sleep` | `submitMorningPopup` (wake time on `date`, bedtime on the day before, then hours slept) | `already so` |

Details:

- **Shared helpers:**
  - `inboxWindowError` checks a date against the same lookback window as `check_block` (`addDays(today, -PAST_DAYS_LOOKBACK)` through today), with the same reject notes.
  - `inboxRecurrenceForm` turns a payload recurrence into the form object that `buildRecurrenceFromForm` reads. Weekdays need a non-empty list of `ALL_DAYS` letters and are stored in `ALL_DAYS` order. everyN needs an integer `n` from 1 to 365. Any other kind is rejected.
  - Block labels must be non-empty after trimming and at most 80 characters.
- **`add_block` everyN anchor:** it is the local date of `row.created_at`. This reuses `buildRecurrenceFromForm` by passing it an existing everyN anchor of `ymd(createdAt)`.
- **`edit_block` recurrence** is built with `buildRecurrenceFromForm(f, b)`, so an existing everyN anchor is kept.
- **`edit_item` rules:**
  - `title` is at most 200 characters after trimming. `date` may be null only for a to-do. `priority` must be one of `INBOX_PRIORITIES`. `notes` is trimmed.
  - `time` and `duration_min` are allowed only on events and must come together. A null `time` stores `time = null, duration = null`.
  - Any other key is rejected, and so is an empty `set`. A `kind` in the payload that doesn't match the item is rejected (`kind mismatch`).
  - Untouched fields stay as they are, including a legacy to-do's stored time.
- **`set_sleep` times** must be HH:MM and pass `isPlausibleWakeTime` / `isPlausibleBedtime`. A time is never rewritten.
- **`computeAndStoreHoursSlept(date = todayDate())`** reads wake time from `date` and bedtime from `addDays(date, -1)`, with the same wrap and 1–14 h bounds. The existing calls pass no argument and behave exactly as before.

**`applyAgentInbox`:**
- After the pending fetch, one more GET picks up rows that a v102 copy of the app turned away: `status=eq.rejected`, `note=eq.unknown%20op`, `op=in.(edit_item%2C…%2Cset_sleep)`, `created_at=gte.<3 days ago, encoded>`, oldest first, limit 50.
- Those rows are de-duplicated by `op_id`, merged with the pending rows, sorted by `created_at`, and go through the same loop and PATCH.
- If the extra GET fails, it logs a warning and the pending rows still apply.
- After a run that changed anything, it also calls `renderSpaceView()` if the space overlay is open.

**Version:** `VERSION` in `sw.js` and `APP_VERSION` in `index.html` are both `'v104'`.

## Self-check

How I tested: I served the repo with `python3 -m http.server 8000` and drove the real `http://localhost:8000/index.html` in headless Chrome over the DevTools protocol (Node script in the session scratchpad). A script injected before the page's own scripts answered every `*.supabase.co` request locally and recorded each URL. It handled the `agent_inbox` GET filters (status, note, op list, `created_at` cutoff), the PATCH, and `app_state` / `app_events`; no real account was used.

The fixture state had:
- items: a timed event, a dated to-do, a someday to-do, a done to-do with two completions on different dates, and a tombstoned to-do;
- blocks: a weekly checkbox checked yesterday, a weekdays block, a daily block, a counter and a notes block;
- two spaces, a focus session, and daily_state for yesterday and today.

Where an in-app path could be called directly, the test ran it on a fresh copy of the same fixture and compared the whole state blob. Before comparing, it ignored `meta.updated_at` and tombstone timestamps, plus the new block's id and createdAt for `add_block`. Result: 88 of 88 assertions passed.

| # | Check | Result |
|---|---|---|
| 1 | All ten kinds applied once make the expected change. The second apply of the same row returns `applied` with an "already …" note and leaves the state byte-for-byte the same.<br>The inbox result is identical to the in-app action for: `delete_item` (`deleteCurrent`), `uncheck_block` (`onPastDayClick`), `add_block` counter / notes / weekdays / daily (`saveBlockForm`), `edit_block` counter label+unit, checkbox→everyN and notes text (`saveBlockForm`), `delete_block` (`deleteBlockById`), `log_counter` today (`saveCounterLog`), and `delete_focus_session` (`deleteFocusSession`).<br>Checked field by field instead: `edit_item` (moving the event to +2 days at 14:30 for 45 min stores `duration` 0.75, trims the title and keeps `created_at`; a to-do moved to someday keeps its legacy `time`; all-day sets time and duration to null), `uncomplete_item` (both completions removed and tombstoned), `log_counter` 2 days ago (overwrites, still one entry), and `set_sleep`. | **PASS** |
| 2 | Rejected, with the state byte-for-byte unchanged: unknown key in `set`; time on a to-do; null date on an event; tombstoned item (edit and uncomplete); a date 15 days back; a future date; wake 20:00; bedtime 12:30; weekdays with no days; `add_block` into a missing space. Also rejected: `unit` on a checkbox, `set_sleep` with no time, block type `goal`. | **PASS** |
| 3 | `add_block` everyN with `created_at` at 23:30 local two days ago: the anchor is that local date. Order is 3 (max 2 + 1). Applying twice adds one block. A tombstoned `op_id` returns `deleted in app` and changes nothing. | **PASS** |
| 4 | `delete_block` renumbers its siblings to `[bWd 0, bD 1]`. `delete_item`, `delete_focus_session` and `delete_block` write tombstones, and all three deletes survive `mergeStates` with a pre-delete copy on either side. | **PASS** |
| 5 | `set_sleep` for yesterday (bed 23:45, wake 08:15) sets yesterday's `wake_time`, the day before's `bedtime`, and yesterday's `hours_slept` to 8.5. Yesterday's own bedtime and today's row are untouched. The no-argument `computeAndStoreHoursSlept()` matches the previous commit's version exactly in 8 cases: normal, after midnight, the 12:33 mis-entry, missing wake, missing bed, no today row, 18:00→13:59, and 23:59→00:30. | **PASS** |
| 6 | `applyAgentInbox()` with stubbed fetch: the retry GET is sent with encoded values. A row rejected `unknown op` 1 day ago is applied and PATCHed `applied` (with `applied_at` and `note`). One from 4 days ago is neither applied nor PATCHed, and the pending row is still applied. | **PASS** |
| 7 | `confirm`, `alert` and `prompt` were never called during any inbox apply, and neither were `logQueued` / `logAppEvent`. No `app_events` request was made, and the inbox run made only `agent_inbox` requests. A grep of `applyInboxRow`…`applyAgentInbox` finds no dialogs, event logging, `hub_messages` or `app_events`. | **PASS** |
| 8 | `git diff --stat`: only `index.html` and `sw.js`. `VERSION = 'v104'` and `APP_VERSION = 'v104'`. On page load, 0 JavaScript errors or exceptions. The only console line was Chrome's automatic `GET /favicon.ico` 404: the repo has no favicon and `index.html` has no icon link, so this is the same before this change and unrelated to it. | **PASS** (with that note) |

Not verified here: the live end-to-end pass, where a Hub request produces one approval card and, after Approve, every device shows the change once. That needs agentkit, the deployed site and a real account.

## Things to know

- The recurrence in a payload is read as `{kind, days?, n?}`. If agentkit sends a different shape, those rows are rejected with `invalid recurrence` and nothing changes.
- `edit_item` compares stored values with `?? null`, so a missing `notes` on an old record counts as different from `''`. That costs one harmless write, and the next apply returns `already so`.
- A `log_counter` that repeats the same value for that date returns `already so`.
- `set_sleep` returns `already so` when every time given already matches, even if `hours_slept` was stale.
