# v105: focus report

Commit `ada9683` "v105: focus asks what you're working on and what got done; drops taps; catches forgotten sessions", pushed to `main` (Render deploys it). Changed: `index.html` (+251 / −11), `sw.js` (version), and one selector in `styles.css` (see below).

## What changed

**Start: "What are you working on?"**
- "Start Focus Session" now opens a sheet first. It reuses the space bottom sheet with the existing `past-days-row` / `space-tick` / `field` / `form-actions` classes, so it looks like the rest of the app.
- Rows come first: today's open to-dos (`trackCompletion`, dated today, no completion), then today's due, unchecked checkbox blocks with their space name (spaces in order, blocks in order). Below them is an "Or type it" input with a 200-character maximum.
- Picking a row fills the input and marks the row. Typing afterwards keeps the link, and tapping the selected row again unselects it.
- Start with text calls `startFocusSession({ text, ref? })`. Skip, or Start with empty text, calls `startFocusSession(null)`. `activeFocus` and `focus_start` are exactly as before, plus `plan` when there's text. Tapping outside the sheet starts nothing.
- The overlay shows the plan as one small line under the timer (the existing `focus-tap-hint` style).

**End: "What did you get done?"**
- End & Save calls `finishFocusSession(new Date())`, so the end time is the tap.
- Under 60 seconds: nothing is saved. `activeFocus` is cleared, `saveState()` runs, `focus_end` is logged, the overlay closes and the toast reads "Under a minute, not saved".
- Otherwise the record is **saved right at the tap**, with the same shape (`id, date, start, end, lapses, lapseOffsets, type`) plus `plan` if there was one. `focus_end` is logged then, and the "What did you get done?" sheet opens.
- The sheet only adds `done` to the already-saved record: Save adds the trimmed text if it isn't empty, and Skip adds nothing. Tapping outside the sheet counts as Skip. Because the record is already saved, any other way the sheet closes (a back gesture, a reload, the app being killed) also counts as Skip, so a session is never lost or half-saved. Adding `done` later is a field edit on the record, the same as retagging, and merges newer-wins like any other edit.
- The "Focus session saved" toast shows when the sheet closes.

**Forgotten sessions**
- `focusIsForgotten`: 3 hours or more since `stillGoingAt` (or since the start), or a 6:00 AM boundary has passed. The night-day of a time is `ymd(time − 6 h)`, and a boundary has passed when now's night-day is later than the start's.
- `checkForgottenFocus()` runs at load (from the card render and the existing overlay resume), when the app comes back to the front (`visibilitychange`), whenever the card is rendered, and in `openFocusOverlay`. It never takes over a sheet that is already open for something else.
- The sheet reads "Your focus session from 2:10 PM is still running. When did you stop?". The weekday is added (for example "Thursday 11:00 PM") when the start wasn't today. It has a `datetime-local` input: default start + 60 min (capped at now), min start + 1 min, max now.
  - **Save with this time** calls `finishFocusSession(end, stated)`. The record gets `endStated: true` and `date = ymd(start)`. Offsets after the chosen end are dropped, and `lapses` becomes the number kept. `focus_end` is logged, then the "What did you get done?" sheet opens. The under-a-minute rule applies here too. A time that isn't between the start and now shows an inline error.
  - **Still going** appears only if no 6:00 AM boundary has passed. It sets `activeFocus.stillGoingAt = nowIso()` and calls `saveState()`, and the check asks again 3 hours later.
  - **Discard** calls the existing `discardFocusSession()`, confirm included. If the confirm is cancelled, the sheet comes back.
  - Tapping outside doesn't dismiss this sheet, because it needs an answer.

**Showing it**
- Session detail: right under the title there is one note block (the existing `focus-detail-note muted`) with:
  - "Working on: {plan}", plus "· to-do" or "· block" when the linked to-do or block still exists;
  - "Got done: {done}", with line breaks kept;
  - "End time entered by you" when `endStated`.

  Every value goes through `escapeHtml`. Nothing is scored, compared or labelled "completed".
- Recent sessions list: the plan appears as a second line across the row (existing `space-block-sub` style), cut at 60 characters with "…".
- Sessions without a plan or done render exactly as before.

**`styles.css`:** `input[type="datetime-local"]` was added to the existing selector list for text, time and date inputs. The app had no style for that input type, so without it the field rendered as a tiny unstyled browser box. Nothing else in the file changed.

**Version:** `VERSION` in `sw.js` and `APP_VERSION` in `index.html` are both `'v105'`.

## Self-check

How I tested: I served the repo with `python3 -m http.server 8000` and drove the real page in headless Chrome over the DevTools protocol (Node script in the session scratchpad). Supabase was stubbed locally, as in v104. `Date` was replaced with a shiftable clock so the tests could fix the time of day and jump forward 30 s or 3 h. `confirm`, `alert` and `prompt` were counted, and `logQueued` was wrapped to record `focus_start` and `focus_end`.

The fixture had today's open to-do, a done to-do, tomorrow's to-do, an event, a due unchecked block, a checked block, a notes block, and two older sessions (one typed with offsets, one untyped with no offsets).

For check 7, a copy of the previous commit (`8d61f2d`) was served on port 8002 and loaded with the same fixture and the same clock. Result: 49 of 49 assertions passed on a fresh browser.

| # | Check | Result |
|---|---|---|
| 1 | Start opens the sheet and the timer doesn't start. Rows are "Problem set 4 · To-do" then "Stretch · Health"; the done to-do, tomorrow's to-do, the event and the checked block are left out.<br>Picking fills the input, tapping again unselects, and typing after picking keeps the link: `plan = {"text":"Problem set 4, q1-10","ref":{"kind":"item","id":"tOpen"}}` (trimmed). `activeFocus` keys are `start,type,lapses,lapseOffsets,plan`, and `focus_start` is logged once.<br>The overlay shows the plan line. Skip, and Start with empty text, leave no `plan` and hide the line. Typed-only text gives a plan with no `ref`. | **PASS** |
| 2 | Session ended after 2 min, sheet held open 30 s on the shifted clock, "did problems 1-20" typed, Save. The record's keys are `id,date,start,end,lapses,lapseOffsets,type,plan,done`. `end` is within 1 s of the tap, not 30 s later, and the duration is exactly 120 s. `focus_end` was logged once and the toast reads "Focus session saved". | **PASS** |
| 3 | Ended after 20 s: no session saved, `activeFocus` null (also in localStorage), no sheet, toast "Under a minute, not saved", `focus_end` logged, and the `app_events` POST was sent. | **PASS** |
| 4 | (a) Start 4 h ago (10:00, now 14:00): the sheet appears on load and the overlay stays closed. The wording is "…from 10:00 AM is still running…" and the input is 11:00 / min 10:01 / max 14:00. Outside taps don't dismiss it. Saving at start + 50 min gives a 50-minute record with `endStated: true`, `date` = the start's date, offsets `[600,2000,2999]` kept and `3001,5000` dropped, `lapses: 3`, the plan kept and no `done`. `focus_end` is logged.<br>(b) After "Still going", visibility, render and opening the overlay all stay quiet at 2 h 59 m; the sheet comes back after 3 h.<br>(c) Started 11 PM yesterday, opened at 7 AM: the sheet shows "…from {weekday} 11:00 PM…" with no "Still going".<br>(d) Started 5:00, now 6:30: forgotten by the boundary alone, no "Still going". Discard with the confirm cancelled keeps the session and brings the sheet back; with OK it discards as before.<br>(e) 22:00 → 23:30: not forgotten, and the overlay resumes as before.<br>(f) A chosen end 30 s after the start: not saved, under-a-minute toast. | **PASS** |
| 5 | Text typed in the "got done" sheet, then a tap outside: the session is saved without `done` (also in localStorage), the sheet closes, and the toast shows. | **PASS** |
| 6 | Plan `<b>x</b> …`, done `<b>x</b>\nline 2`, `endStated`: the detail view has zero `<b>` elements and shows "Working on: <b>x</b> … · to-do", "Got done: <b>x</b>" plus "line 2" on its own line, and "End time entered by you". A linked block shows "· block", and a linked item that no longer exists shows no tag. The recent list shows the escaped plan cut to 60 characters with "…". No "completed" or score text. | **PASS** |
| 7 | Old sessions: the whole Focus main view HTML, both old sessions' detail HTML, and the Today focus card HTML are identical, character for character, to the previous commit with the same fixture and clock. No `confirm`, `alert` or `prompt` fired anywhere in the run except the existing discard confirm in 4d (twice: cancel, then OK). | **PASS** |
| 8 | `git diff --stat`: `index.html`, `sw.js`, `styles.css` (1 line). `VERSION = 'v105'` and `APP_VERSION = 'v105'`. Page load: 0 JavaScript errors or exceptions. The only console line was Chrome's automatic `/favicon.ico` 404 (the repo has no favicon), the same as before. | **PASS** |

I also looked at phone-width screenshots of the three sheets and the overlay with a plan line. The blurred morning check-in behind the sheets in those screenshots is only because the fixture has no wake time for today.

A note on testing: midway through, I found leftover headless Chrome processes from earlier runs. A new run had attached to an old browser, whose service worker was serving the `styles.css` from before the one-line change. I killed them all and reran the full suite from a fresh profile; the 49/49 above is that clean run.

Not verified here: the live pass on the deployed site (a real session's plan and "got done" in its detail view, and a 10-second tap leaving nothing). The Hub answering "what did I get done in focus today?" also depends on the Hub/agentkit side reading `plan` and `done` from `focusSessions`, which this change doesn't touch.

## Things to know

- The record is saved when End is tapped and `done` is added afterwards. A device that syncs while the sheet is open briefly has the session without `done`, and then gets `done` on the next push, newer-wins like a retag.
- The forgotten-session sheet can't be dismissed by tapping outside. It goes away only through Save, Still going or Discard, so a forgotten session never sits behind other screens.
- The forgotten check isn't on a timer while the overlay is open in front of him. It runs on load, on return to the front, and on render.
