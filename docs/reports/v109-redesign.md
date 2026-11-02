# v109: redesign (Nov 2)

Ask: "change up the UI of agendaAI completely ... more modern and readable ... it looks like AI slop right now. Every page revamped. mainly calendar and home."

## The look
- One family (Inter), sentence case everywhere. The monospace uppercase labels are gone (`--font-mono` now points at the sans stack; numbers keep tabular figures).
- Soft neutral page (#f6f6f7), white cards with a hairline edge instead of shadows, one cobalt accent (#3657e8, 5.7:1 on white) for actions and study blocks, red only for what's due.
- Line icons (one small fixed set, `ICONS` in index.html) replace the emoji tiles in the tab bar, rooms, doorways, review row and room titles. Space icons stay as he set them.
- No gradients or glows (the v108 blue-to-purple capsule and the Hub's header wash are gone).

## Shell
- Header: date and actions on the first line, the page's large title under it (Today, Upcoming, Calendar, Stats, Settings). Hub, Off-track and a round + button.
- Tab bar: icon plus label; the active tab is dark with an accent icon.

## Home
- Next 3 days is a plain agenda: time column, a rail (accent = study block, grey = event, red = due), title, one meta line. On today a red "Now" line sits at the current time, or the running event is highlighted with a "Now" tag. Past events fade, done to-dos strike through. The 8am-midnight strip is retired.
- Spaces: one row per space with a dot per item due today (filled when checked) and "n left"; the header says what's left today.
- Focus, Practising, Sunday review, rooms (grid, list and row presets) and My Code use the same card recipe.

## Calendar
- Month title with Today, previous and next; swipe the grid sideways to change month.
- Each day shows what's on it, up to three dots: due (red), study block (accent), event (grey), to-do (ring), with a key under the grid. The old per-day completion tint (a score per day) is gone.
- The selected day's list uses the same agenda rows as Home (tap to edit; Add opens the form on that day). "Tracker 4 of 12" replaces "4/12 completed (33%)".

## Other pages
- Upcoming: rows sit flat inside each group card (no card-in-card), priority bar replaced by a red ring on high-priority to-dos and a rail on events (accent for study blocks).
- Stats: the overview tiles show counts ("12 of 23 this week") instead of percentages.
- Settings: group captions sit inside the flow (the old -32px trick overlapped the card above).
- Rooms and sheets inherit the tokens; Done is the accent action, the add buttons are tinted instead of solid.
- Hub (hub.html) picks up the same tokens through styles.css; its gradients were removed.

## Checked
Headless renders at 390, 320 and 1280 px with made-up data, plus 46 functional checks (tabs and titles, agenda rows, Now line before / during / after events, action sheet, calendar dots and order, picking days, other-month days, Today, prev/next, swipe, add and edit from the day list, Upcoming check-off, space rows and dots, rooms, focus start, room presets, count tiles, no emoji in the chrome, no page errors): all pass.
