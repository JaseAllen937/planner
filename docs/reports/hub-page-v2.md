# Hub page v2: report

Commit `9773dce` "hub page: open at the bottom, one conversation per screen, Today button", pushed to `main` (Render deploys it). Only `hub.html` changed (+79 / −3).

## What changed

1. **Opens at the bottom.** The first successful load after sign-in or page load (`applyOpen()`) makes that render scroll to the newest message. The scroll runs once right away and again on the next animation frame, because the notices and the working line can resize the list after layout. The "New messages" pill stays hidden. If the page was hidden for 5 minutes or more (`AWAY_MS`), it scrolls to the bottom when it becomes visible again. A shorter absence keeps your scroll position, as before.
2. **One conversation per screen** (display only; no row is ever edited or deleted):
   - A conversation boundary is a `user` row whose body is `/new` (the conversation starts on the row after it), or a gap of 45 minutes or more (`CONVO_GAP_MS`) between two consecutive rows by `created_at`.
   - Normally only rows from the latest boundary onward show. If the newest row is 45 minutes old or more when the page opens, its id becomes a floor, so the screen starts empty with the existing empty-state line, and new rows show as they arrive.
   - **Show earlier messages** appears at the top whenever loaded rows are hidden, or older pages exist. It reveals everything loaded, and from then on the existing **Load older** works as before. If nothing loaded was hidden (one conversation longer than the first 100 rows), the tap also fetches the older page. The reveal lasts until a reload, sign-in, or New chat.
   - **New chat** sends `/new` as before. Once the row comes back, the screen clears (only rows after it show) and the reveal resets.
   - When earlier messages are revealed, a thin **New conversation** divider marks each boundary. For a `/new` boundary, it sits after the "New chat" bubble.
3. **Today button.** It is the first quick button and sends exactly `/today`. The row shows as "Today" through `COMMAND_LABELS`.
4. **Unchanged:** session key `agendaai_hub_session`, escaping and formatting (`escapeHtml` first, then only bold and https links), polling, approval cards, and the "is it working" line. The working line still looks at all loaded rows, including hidden ones.

## Self-check

How I tested: headless Chrome ran a harness page in the session scratchpad (not the repo). It loads copies of `hub.html` with `fetch` stubbed to serve fixture rows and record POSTs, then asserts on the real DOM. Result: 29/29 assertions passed.

| # | Check | Result |
|---|---|---|
| 1 | `git diff --stat` before commit: `hub.html \| 82 +++…---`, 1 file changed, nothing else | **PASS** |
| 2a | Rows at 9:00, 9:05 and 11:00 (that is, −130, −125 and −10 min): only "eleven" shows, with Show earlier messages | **PASS** |
| 2b | Rows old, old reply, `/new`, fresh, fresh reply: only "fresh" and "fresh reply" show | **PASS** |
| 2c | Newest row 50 min old on open: empty-state line and Show earlier messages. A new row arriving afterwards shows | **PASS** |
| 2d | Show earlier: (a) shows all 3 rows with 1 "New conversation" divider before "eleven". (b) shows all 5, with the divider right after the "New chat" bubble. The button goes away once revealed. With 150 rows in one conversation, Show earlier loads the older page (150 shown) | **PASS** |
| 2e | 60-row conversation: scrolled to the bottom after load (scrollTop + clientHeight = scrollHeight), and the pill is hidden. After 6 min hidden it returns to the bottom; after 1 min the scroll position is kept | **PASS** |
| — | New chat: posts exactly `{"role":"user","body":"/new"}`. The screen clears to the empty state immediately and Show earlier comes back | **PASS** |
| 3 | Today is the first quick button and posts exactly `{"role":"user","body":"/today"}`. The row shows as "Today" | **PASS** |
| 4 | `python3 -m http.server 8000` served the real page at http://localhost:8000/hub.html in headless Chrome. It showed the sign-in form, with 0 console messages and 0 page errors in the harness runs | **PASS** |
| — | Hard rules: grep finds no `agendaai_session`, `agendaai_v1`, `agendaai_synced_at`, `PATCH` or `DELETE` in `hub.html`. After the runs, `hub.html` had written only `agendaai_hub_session` to localStorage. The `<img onerror>` payload is still escaped, and only one `<strong>` and one `<a>` are rendered | **PASS** |

Not verified here: the live pass on the deployed site with the PC running, including the "Today answers in a couple of seconds" check. That depends on the PC side handling `/today`.

## Things to know

- The 45-minute clean screen is decided once, when the page opens. If the page stays open and visible through 45 quiet minutes, the old conversation stays on screen until the next message arrives. A message after a 45-minute gap is a boundary, so at that point the screen clears down to it.
- Gaps are measured between consecutive rows of any role, including status and button rows, the same way the boundary rule is written.
