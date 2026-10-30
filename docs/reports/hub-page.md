# Hub page: report

Commit `01dc3eb` "hub page: chat with the assistant from the AgendaAI site", pushed to `main` (Render deploys it).

## What was built

Two new files, nothing else touched:

- **`hub.html`**: standalone chat page with one inline `<style>` and one inline `<script>`. It links `styles.css` for the app's variables and `.btn` look. It does not register a service worker. `sw.js` still controls the page because its scope is `./`, but its fetch handler is `caches.match(req) || fetch(req)` and `hub.html` isn't in `ASSETS`, so the page always comes from the network.
- **`hub.webmanifest`**: name "AgendaAI Hub", short_name "Hub", `start_url ./hub.html`, `scope ./`, standalone, with the same icons and colors as `manifest.json`. The page links it along with `apple-touch-icon`, `apple-mobile-web-app-capable`, a viewport meta, and the title `Hub · AgendaAI`. I also added `mobile-web-app-capable`, because Chrome logs a deprecation notice when only the Apple meta is present.

How it works:

- **Its own sign-in.** The session is stored under `agendaai_hub_session` only. `hubSignIn` sends the same request as `supaSignIn`, and `hubRefreshToken` the same as `supaRefreshToken`. Concurrent refreshes share one in-flight promise, so two 401s can't both spend the single-use refresh token.
- **`hubFetch`** adds the apikey and bearer token and does one 401 → refresh → retry. If the refresh fails, it clears only the Hub key and shows the sign-in form. "Sign out of Hub" clears only the Hub key.
- **Layout.** A header (Hub, Back to app, Sign out of Hub), the five quick buttons, a scrolling list, a "New messages ↓" pill when he has scrolled up, the setup/retry notices, the "is it working" line, and a composer pinned at the bottom. The textarea grows to about 6 lines. On a fine pointer, Enter sends and Shift+Enter makes a new line; on touch, Enter makes a new line. Text is trimmed, empty text isn't sent, `maxlength=4000`, and a counter appears past 3500. Send is disabled while sending; the box clears on success and keeps the text on failure, with the error shown under it.
- **Rendering.** The list is built as an HTML string where every row body goes through `escapeHtml` first:
  - `user`: right-aligned accent bubble; the five commands show as their friendly labels.
  - `assistant`: left-aligned card bubble. After escaping, the only additions are `**x**` → `<strong>` and `https://` URLs → `<a target="_blank" rel="noopener noreferrer">`.
  - `status`: a muted centered line.
  - `approval`: a bordered card. Approve uses `btn-primary` and Deny is plain. `buttons: null` shows "Decided".
  - `button` rows aren't shown.
  - Times (h:mm AM/PM) appear under bubbles, with Today / Yesterday / weekday date dividers.
- **Approval taps.** Each button carries only numeric indices (`data-card`, `data-g`, `data-b`). The tap handler looks up the label and data from the row in memory and marks the card `sending` synchronously before the insert, so a second tap returns early. The card stays disabled ("Sent. Waiting for your PC…") until the PC sets `buttons` to null. It also stays disabled after a reload if a `button` row with that `ref_id` already exists.
- **Loading.** The first load fetches 100 rows. "Load older" appears when 100 come back and uses `id=lt.<oldest>`, keeping the scroll position.
- **Polling.** Polls fetch 30 rows and merge them by id. There is one `setTimeout` handle, and every schedule clears it first. A poll requested while another is in flight is queued with a flag rather than run in parallel. The interval is 2.5 s while the working line shows and 10 s otherwise. Polling stops when the page is hidden and runs right away when it becomes visible.
- **Sending.** A send POSTs with `Prefer: return=representation`, adds the returned row, scrolls to the bottom, then polls.
- **Errors.** A 404 or `PGRST205` shows "The Hub isn't set up yet: run sql/hub_messages.sql in Supabase." Any other error shows a small "Can't reach the Hub right now. Retrying…" notice. There are no pop-ups.

## Self-check

How I tested: Node isn't installed here, so I ran headless Chrome against a harness page in the session scratchpad (not the repo). It loads a copy of `hub.html` in an iframe, stubs `fetch` and `setTimeout`, and asserts on the real DOM: 30 assertions, 29 passed. The one failure was my test's own count: it expected 5 time stamps, but the fixture has 6 bubbles (2 user, 2 assistant, 2 approval), and all 6 show a time. I also looked at a phone-width screenshot of the populated chat.

| # | Check | Result |
|---|---|---|
| 1 | `git status` / `git diff --stat` before commit: only `?? hub.html` and `?? hub.webmanifest`; no tracked file changed | **PASS** |
| 2 | Grep: `agendaai_session`, `agendaai_v1`, `agendaai_synced_at` don't appear in `hub.html`. The only storage calls are `localStorage.get/set/removeItem(HUB_SESSION_KEY)`, where `HUB_SESSION_KEY = 'agendaai_hub_session'`. The only REST calls are GET ×3 and POST ×1 on `/hub_messages` (no PATCH or DELETE, no other table). No alert/confirm/prompt, no service worker, no CDN. | **PASS** |
| 3 | Escaping. The body `<img src=x onerror=alert(1)> **hi** https://example.com/?a=1&b=2` was put in `user`, `assistant`, `status` and `approval` rows. Result: zero `<img>` elements in the list; the literal text `<img src=x onerror=alert(1)>` is visible 4 times; exactly one `<strong>hi</strong>` (assistant only); the assistant link `href` is exactly `https://example.com/?a=1&b=2` with `_blank` and `noopener noreferrer`; there are no links in the other three roles. In the code, `escapeHtml` runs first. Bold runs before links, so `**` can't land inside an `href`. The URL pattern stops at whitespace, `<`, and the escaped `&lt; &gt; &quot; &#39;`, so it can't swallow a tag or break out of the quoted attribute. Trailing `.,!?:;)]` is left out of the link, but the `;` of `&amp;` is kept. | **PASS** |
| 4 | Approve: clicking Approve 3 times plus a direct `tapCardButton` call posted exactly one row, `{"role":"button","body":"ap:4","ref_id":4}`. The card's buttons are disabled with "Sending…" immediately and stay disabled after the send. `buttons: null` shows "Decided". Working line: `new` under 45 s shows "Sending to your PC…" (status rows skipped); `new` at 45 s or older shows "Your PC hasn't picked this up. Is it on, with the Hub running?"; `done` shows "Working" with animated dots; an assistant row as the newest non-status row hides the line. User sends post only `{role, body}`, trimmed. | **PASS** |
| 5 | Polling: after `pollNow(); pollNow(); schedulePoll(); schedulePoll(); pollNow();`, exactly 1 live timer. Hidden: 0 timers and `pollTimer === null`. Visible again: an immediate poll, then 1 timer. A 401 with a failed refresh: Hub key cleared, sign-in shown, 0 timers. | **PASS** |
| 6 | Real page served by `py -m http.server 8000`, `http://localhost:8000/hub.html` opened in headless Chrome: no errors. The only console line was the deprecation note for `apple-mobile-web-app-capable`, which I fixed by adding `mobile-web-app-capable`. Signed out, it shows the sign-in form. `hub.webmanifest` is served as `application/manifest+json` and parses. | **PASS** |

Not verified here: the live end-to-end pass (signing in at kjsvault.org/hub.html, the "Hub connected" message, a real answer from the PC, Approve creating a to-do). That needs the deployed site, real credentials, and `py hub.py listen` running.

## Things to know

- Polls fetch only the newest 30 rows, so a change to an older approval card (`buttons` → null) only shows after a reload. That doesn't matter in normal use.
- If the PC never sets `buttons` to null after a tap, the card stays disabled ("Sent. Waiting for your PC…"). This is deliberate, to stop double-sends.

## Follow-up: two changes to the "is it working" line

The first version had a gap. The line looks at the newest row that isn't a `status` row. If the PC answered a Deny (or a skipped job) with only a status line, that newest row stayed the `done` button row, so "Working…" showed forever and the page polled every 2.5 s. The same happened if the PC marked a message `done` and then crashed. Both cases are now fixed in `workingState()` in `hub.html`:

1. **A decided card counts as finished.** If the newest non-status row is a `done` `button` row and its approval card (`ref_id`) is loaded with `buttons: null`, the line is hidden. The other cases are unchanged:
   - a tap still marked `new` shows "Sending to your PC…" or the 45-second warning, even if the card is already decided;
   - a `done` tap whose card is still open, or isn't loaded, shows "Working…";
   - `user` rows work as before.
2. **No reply after 5 minutes.** If "Working…" would show but the newest row of any role, status lines included, is 5 minutes old or more, the line instead says "No reply after 5 minutes. Check that your PC is on and the Hub is running." It uses the same red warning style as the 45-second message. Polling drops back to every 10 s in this state, while "Sending…", the 45-second warning, and "Working…" still poll every 2.5 s. Any new row resets the clock, including a status line like "still on it". The age is measured from `created_at`, the same way as the 45-second check, so it survives a reload.

### Self-check for the follow-up

Tested the same way as before: headless Chrome, a copy of the page, faked network responses, run from the scratchpad. 17 of 17 new checks passed, the original 30-check suite gave the same results as before (29 pass plus the known test miscount), and the real page served on port 8000 loads with no console output.

| # | Check | Result |
|---|---|---|
| F1 | `done` tap with its card still open: "Working…" | **PASS** |
| F2 | `done` tap with its card decided: hidden, also when a status line follows ("Denied #1"), and the DOM line is hidden | **PASS** |
| F3 | `new` tap with its card decided: still "Sending to your PC…" (the PC hasn't picked it up) | **PASS** |
| F4 | `done` tap with its card not loaded: "Working…"; `done` user row: "Working…" (unchanged) | **PASS** |
| F5 | `done` row with the newest row 4m59s old: "Working…"; 5m old: the no-reply text, in red, visible | **PASS** |
| F6 | A status row 1 minute old after a `done` row 10 minutes old: "Working…" (any new row resets the clock) | **PASS** |
| F7 | `done` tap 6 minutes old with its card still open: the no-reply text; a `new` row 10 minutes old stays the 45-second warning, not the no-reply text | **PASS** |
| F8 | Poll interval: "Working…" 2500 ms, no-reply 10000 ms, 45-second warning 2500 ms, no line 10000 ms | **PASS** |
| F9 | Original suite (escaping, approve taps, polling timer, sign-in) and console check: no change | **PASS** |
