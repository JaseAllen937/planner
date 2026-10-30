# v107: undo report

Commit `ae2667a` "v107: focus starts straight away; the inbox can undo deletes, counters, and sleep", pushed to `main` (Render deploys it). Changed: `index.html` (+85 / −111 in all three files together), `styles.css` (one rule removed, one comment shortened), and `sw.js` (version).

## What changed

**1. Focus Start goes straight to the timer**
- With no session running, "Start Focus Session" calls `startFocusSession(null)` with the type picked on the card, as before v105. No sheet opens.
- Removed: `openFocusPlanSheet`, `focusPlanCandidates`, and the CSS rule `.focus-tiles .scale-btn`.
- Kept: `.focus-tiles` (Focus page stats) and the `.focus-sheet-*` rules (done and forgotten sheets).
- Unchanged from v105: the "What did you get done?" sheet at End, sessions under a minute not saved, forgotten sessions, lapses, types, and an old session's `plan` in the overlay and detail view.

**2. Block settings lose the focus toggle**
- The toggle is gone, along with its `focusOption` handling in `openBlockSheet`, `buildBlockSheet`, `syncBlockInputs` and `saveBlockForm`.
- Saving a block leaves any existing `focusOption` alone.
- `edit_block` no longer allows `focus_option`, so it is rejected again as `invalid field focus_option`. The `focusOpt` code is removed.

**3. The inbox can put a deleted thing back**

Each restore op starts with two checks. If a record with id `op_id` is already in the collection, it returns `done('already present')`. If `tomb['<collection>:' + op_id]` exists, it returns `done('deleted in app')`.

A shared helper, `inboxRestoredCopy`, deep-copies `payload.record` and sets `id = op_id`. Every other field is kept as given, including `createdAt` / `created_at`, `checks`, `entries` and `lapseOffsets`. A missing or non-object record is rejected with `invalid record`. Validation happens before any state change.

- **`restore_item`**
  - Needs a non-empty string `title` and a boolean `trackCompletion`; the copy is pushed onto `state.items`.
  - If `payload.completion` is an object, a copy is pushed onto `state.completions` with `ref_type: 'item'` and `ref_id: op_id`, keeping its `id`, `date`, `time_done` and every other field.
  - **Completion id:** when the given id is free, it is kept. This is the normal path, because agentkit sends a fresh completion id. When the id is already taken or tombstoned, the copy gets the id `<op_id>-completion` instead.

    The reason: a delete (`delete_item` or the in-app delete) leaves the to-do's old completion behind, still pointing at the old to-do. Skipping the completion would bring the to-do back as not done. I also tried re-pointing that old completion, but in testing a newer remote copy of it won the merge and the to-do flipped back to not done.
- **`restore_block`**
  - Needs a string `label` and a known `type` (`checkbox`, `counter`, `cycle`, `goal`, `notes`, in the new `INBOX_BLOCK_TYPES`); otherwise it returns `invalid record`.
  - Needs a `spaceId` whose space exists and isn't tombstoned; otherwise it returns `space not found`.
  - The block is inserted into the space's ordered list at `record.order`, clamped to the block count (missing order means the end). The list is then renumbered with `renumberOrder`, the same way `delete_block` does.
- **`restore_focus_session`**: needs a string `start`. The copy is pushed onto `state.focusSessions`.
- All three ops are added to `INBOX_V104_OPS`, so rows a v106 copy turned away as `unknown op` in the last 3 days are picked up.

**4. Undo for a counter and for sleep**
- **`log_counter` with `value: null`:** removes that date's entry, or returns `done('already so')` if there isn't one. The date window check runs first. A number works exactly as before.
- **`set_sleep` with `clear`:** the optional `clear` is an array of `'wake_time'` and/or `'bedtime_night_before'`.
  - Each listed time is set to null on the matching `daily_state` record (`wake_time` on `date`, `bedtime` on the day before). If that record doesn't exist, it's skipped and nothing is created.
  - Then `computeAndStoreHoursSlept(date)` runs.
  - Rejects:
    - `no time given` when there's no wake time, no bedtime and no `clear`;
    - `clear and set the same time` when a time is both cleared and given;
    - `invalid clear` when `clear` isn't an array of those two names (a reject note the spec didn't name).
  - If nothing would change, it returns `done('already so')`.

**5. Version:** `VERSION` in `sw.js` and `APP_VERSION` in `index.html` are both `'v107'`.

No new fields in the state blob. `mergeStates` and `mergeBlockPair` are unchanged.

## Self-check

**How I tested:** I served the repo with `python3 -m http.server 8000` and drove the real page in headless Chrome over the DevTools protocol, on a fresh profile, with Supabase stubbed as in v104–v106. Inbox rows went through the page's own `applyInboxRow`.

The fixture had:
- one space with four blocks: Block 1 (`focusOption: true`); Read (second, with 5 checks); School Work; and a counter with entries for yesterday and today;
- a done to-do with its completion;
- a focus session;
- `daily_state` for today (wake 07:30) and yesterday (bedtime 23:30).

Result: 51 of 51 assertions passed.

| # | Check | Result |
|---|---|---|
| 1 | Start runs the timer at once with the type picked on the card: no sheet, no `plan` in `activeFocus`, overlay open, `focus_start` logged once. End after 5 min opens "What did you get done?". The removed functions are undefined. A running session that already has a plan still shows it in the overlay. | **PASS** |
| 2 | Block settings have no focus toggle. Saving Block 1 with a new label keeps its `focusOption: true`. `edit_block` with `set: { focus_option: true }` is rejected with `invalid field focus_option`, and the state is unchanged byte for byte. | **PASS** |
| 3 | `delete_item` on the done to-do, then `restore_item` with its record and completion, gives `applied` / changed. The to-do is back under `op_id`, identical to the old record except the id.<br>Because the old completion was still there, the completion copy is under `<op_id>-completion`, with date, `time_done` and `completed_at` kept and `ref_id` set to `op_id`. `isCompletedToday` is true for the restored to-do.<br>The same row again gives `already present` with no change. An empty title, or no record, gives `invalid record` with no change. A tombstoned `op_id` gives `deleted in app`. A completion whose id is free keeps that id. | **PASS** |
| 4 | Read (second, 5 checks) deleted: its siblings renumber to 0–2. Restored: it's second again (`Block 1:0, <op_id>:1, School Work:2, Pushups:3`), with the same 5 checks, label, `createdAt` and recurrence. A second apply gives `already present`.<br>After `saveState()` and a page reload it's still there with 5 checks at order 1. `mergeStates` against the pre-delete copy carrying the `blocks:bRead` tombstone keeps it with 5 checks and drops the old block, with that copy either newer or older. A missing space gives `space not found`, an unknown type gives `invalid record`, and order 99 goes to the end with the space renumbered 0–4. | **PASS** |
| 5 | `restore_focus_session` brings the deleted session back with every field kept, and it shows in the Focus page list. A repeat gives `already present`, and no `start` gives `invalid record`.<br>After a save, a reload and a merge with a newer remote copy holding the `items:` and `focusSessions:` tombstones, the restored to-do, its completion and the session are all kept, and the old records are gone. | **PASS** |
| 6 | `log_counter` with `value: null` for today leaves only yesterday's entry. A second time gives `already so` with no change, a date 20 days back is rejected by the window check, and a number still stores 12.35.<br>`set_sleep` with `clear: ['wake_time']` takes hours slept from 8 to null, with the wake time null and yesterday's bedtime kept. A repeat gives `already so`. Clearing and setting the wake time together is rejected, as are no fields at all and a bad `clear`. Setting the wake time while clearing the bedtime works. Clearing on a day with no records gives `already so` and creates nothing. A plain `set_sleep` still gives 8.5 h. | **PASS** |
| 7 | `git diff --stat`: `index.html`, `styles.css` and `sw.js` only. `VERSION = 'v107'` and `APP_VERSION = 'v107'`. Page load: 0 JavaScript errors or exceptions. The only console line was Chrome's automatic `/favicon.ico` 404 (the repo has no favicon), as in earlier versions. | **PASS** |

No `confirm`, `alert` or `prompt` fired anywhere in the run.

Not verified here: the live pass on the deployed site, and agentkit's side, which covers landing changes without Approve, the Undo button, checking off a block after a focus session, and sending the restore payloads. That code isn't in this repo.

## Things to know

- A restored record keeps its original `createdAt` / `created_at` / `start`. Its tombstone safety comes from the new id, not from a newer timestamp.
- The old to-do's leftover completion (pointing at the old id) is left alone, as it was after the delete. It's harmless, because nothing shows a completion whose to-do is gone.
- `focusOption` fields on existing blocks are now unused and are simply left in place.
