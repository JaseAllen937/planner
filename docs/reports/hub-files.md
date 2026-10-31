# Hub page: file attachments report

Commit `2dd4c1a` "hub page: attach files (syllabi, schedules) for the scheduler and planner", pushed to `main` (Render deploys it). Only `hub.html` changed (+166 / −9).

**Service worker:** `sw.js` doesn't cache `hub.html`. It pre-caches only `./`, `index.html`, `styles.css`, `manifest.json` and the two icons, and its fetch handler serves cache hits but never stores new responses. So `VERSION` and `APP_VERSION` stay at `v107`, and the phone gets the new Hub page from the network on the next load.

## What changed

**1. Attach**
- A round paperclip button (inline SVG, `aria-label="Attach a file"`) sits left of the textarea in `.hub-compose-row`. It uses the same card background and border as the quick buttons.
- It opens a hidden `<input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.csv,.docx">`. After each pick the input is reset, so the same file can be picked again.
- `addFiles` checks each picked file:
  - an extension outside the list (case-insensitive) → "`<name>`: only PDF, images, text, or Word files";
  - over 10 MB → "`<name>`: Up to 3 files, 10 MB each";
  - a 4th file → "Up to 3 files, 10 MB each".

  Refused files aren't added, and their messages go in `#send-err` (with `textContent`, so names are never parsed as HTML). Valid files from the same pick are still added.
- Chips above the textarea show the escaped name and a × button. A long name is cut with "…". The chips are kept after a failed send.
- The attach button and the × buttons do nothing while a send is in progress.

**2. Send**
- Send and Enter work with files and no text. Quick buttons never send files.
- Each file goes up with a plain `fetch` POST to `${SUPABASE_URL}/storage/v1/object/hub-files/${user_id}/${ts}-${safeName}`.
  - Headers: `apikey`, `Authorization: Bearer <token>`, `Content-Type: file.type || 'application/octet-stream'` and `x-upsert: false`. The body is the File itself.
  - On a 401, it refreshes the token once (the shared `hubRefreshToken`) and retries, the same way `hubFetch` does. A failed refresh shows the sign-in form.
  - `safeName` keeps `[A-Za-z0-9._-]` and turns everything else into `_`, with a maximum of 80 characters. When a name is cut, it keeps its extension.
  - `ts` is `Date.now()`, bumped by 1 ms if needed, so two files with the same name in one send never collide.
- After every upload succeeds, one row is inserted: `{ role: 'user', body: text || 'Sent ' + names.join(', '), files: [{ path: '<uid>/<ts>-<safeName>', name, type, size }] }`. The path has no bucket prefix.
- During uploads the Send button reads "Uploading…" and is disabled, along with the attach and quick buttons.
- If any upload fails, nothing is inserted. `#send-err` reads "Couldn't upload `<name>`: `<message>`", and the text and chips stay for a retry.
- Plain messages without files send the same `{ role, body }` as before.
- File contents only ever go to Storage: no base64, and nothing in localStorage.

**3. Show**
- `SELECT` now includes `files`. All three GETs (first load, older page, poll) go through a new `getRows`.
- If a GET fails with code `42703` and a message mentioning `files`, `files` is dropped from `SELECT` for the rest of the page's life and the GET is retried once. Any other error behaves as before.
- In `renderRow`, a `user` row with a non-empty `files` array gets one chip per file under the bubble, "File: `<name>`" (escaped), with no links or previews. When the body is exactly the automatic "Sent …" text, only the chips are shown.

**4. Look:** the new CSS covers only `.hub-attach`, `.hub-chips`, `.hub-chip`, `.hub-chip-name` and `.hub-chip-x`. It uses the page's own variables (`--card`, `--border`, `--muted`, `--text`), 13 px text and pill corners. The chips look the same in the composer and in the chat. They wrap, and long names are cut with an ellipsis, so nothing is wider than the screen.

## Self-check

How I tested: I served the repo with `python3 -m http.server 8000` and loaded the real `hub.html` in headless Chrome at 390 × 844, on a fresh profile.

A script injected before the page's own code replaced `fetch` for `*.supabase.co` with local fake responses:
- **REST:** GETs with `select` handling, plus a switch that answers 42703 when `files` is selected. POSTs to `hub_messages` were stored.
- **Storage:** uploads were recorded with their headers and body, with switches to answer 500 or a first 401.
- **Auth:** token refresh.

The script also seeded `agendaai_hub_session`. `syllabus.pdf` (200 KB on disk) went through the real file chooser path (`DOM.setFileInputFiles`). The other files were in-page `File` objects handed to the real `<input>` through a `DataTransfer` and a `change` event, because a name like `<b>x</b>.pdf` can't exist on disk.

Result: 36 of 36 assertions passed.

| # | Check | Result |
|---|---|---|
| 1 | 200 KB `syllabus.pdf` plus "my calc syllabus":<br>• exactly one upload to `/storage/v1/object/hub-files/uid-123/<ts>-syllabus.pdf`, with `Bearer tok1`, `apikey`, `application/pdf`, `x-upsert: false`, and the File as the body (204,809 bytes);<br>• then one row (upload logged first) with body "my calc syllabus" and `files[0]` = `{path: "uid-123/<ts>-syllabus.pdf", name, type, size}`;<br>• the composer is cleared, the bubble shows the text with a "File: syllabus.pdf" chip, and localStorage holds only `agendaai_hub_session`. | **PASS** |
| 2 | File only: the body is "Sent syllabus.pdf" and the message shows just the chip, with no bubble. Two files give "Sent schedule.png, notes.txt" with two different paths.<br>While uploading, Send reads "Uploading…" and is disabled; afterwards it's back to "Send".<br>An upload that gets a 401 refreshes once and retries with the new token, and the row is inserted. | **PASS** |
| 3 | A 4th file is refused with "Up to 3 files, 10 MB each". 12 MB is refused with "big.pdf: Up to 3 files, 10 MB each". `.zip` is refused with "syllabus.zip: only PDF, images, text, or Word files". No upload and no insert happened.<br>Also checked: × removes a chip, `.docx` and an upper-case `.PDF` are accepted, a space in a name becomes `_`, and an empty type is sent as `application/octet-stream`. | **PASS** |
| 4 | Upload answers 500: no row is inserted, `#send-err` reads "Couldn't upload syllabus.pdf: storage is down", the text "plan this" and the chip stay, and Send is enabled and reads "Send". Retrying after the fault cleared inserts the row. | **PASS** |
| 5 | GET answers 42703 "column hub_messages.files does not exist": the one failed GET is followed by GETs without `files`. The chat shows its 2 messages, and no setup or retry notice appears. A plain message posts exactly `{"role":"user","body":"plain message"}`. Polling keeps running with no errors. | **PASS** |
| 6 | `<b>x</b>.pdf`: the composer chip has no `<b>` element and its text is `<b>x</b>.pdf`. The stored path ends in `-_b_x__b_.pdf`, with the original name kept in `files[0].name`. The message chip reads "File: <b>x</b>.pdf" with no `<b>` and no bubble. An `<img onerror>` name, accepted or refused, never creates an element. | **PASS** |
| 7 | 390 × 844 screenshot of a sent "my calc syllabus" message with its chip, plus the composer holding two chips (one a very long name cut with "…") and text. Page, composer and list `scrollWidth` are all within their widths, so there's no horizontal scroll. The chips use the page's card color, border and pill corners and line up with the bubbles. | **PASS** |
| 8 | `git diff --stat`: `hub.html` only. Page load: 0 errors and 0 warnings. The only console line was Chrome's automatic `/favicon.ico` 404 (the repo has no favicon), as before. No `confirm`, `alert` or `prompt` fired. | **PASS** |

Not verified here: the real Supabase bucket and policies (`sql/hub_files.sql`, `sql/hub_messages.sql`), and the agentkit side, meaning downloading the files and the scheduler and planner posting a plan with Undo. That code isn't in this repo.

## Things to know

- If the second of two uploads fails, the first file stays in Storage even though no row points to it. Retrying uploads both again under new names. Nothing in the chat refers to the leftover file.
- If someone sends files before `sql/hub_messages.sql` has run, the insert fails with "Couldn't send: …" and the chips stay. The chat itself keeps working without the column.
- Upload auth: only an HTTP 401 triggers the refresh, as the spec says. If Supabase Storage reports an expired token some other way (some versions answer 400 "InvalidJWT"), the send shows that error and the next try works once the 10-second poll has refreshed the token.
- The composer's message box is about 80 px tall even when empty, because `styles.css` sets `min-height: 80px` on every textarea. This was already so before this change and wasn't touched.
