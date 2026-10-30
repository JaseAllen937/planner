# Hub link report

Commit `8fcf274` "top bar: Hub link" is pushed to main.

**Changes**
- `index.html:27`: `<a class="btn" id="hub-link" href="./hub.html" aria-label="Open the Hub chat">Hub</a>` is the first child of `.topbar-actions`.
- `APP_VERSION` (index.html) and `VERSION` (sw.js) are both `'v102-hub'`.
- `styles.css:181`: `a.btn { text-decoration: none; }`. You approved this extra change. Without it, `.btn` on a link gets the browser's default underline.

**Self-check**
1. **Pass, with the approved exception.** The diff is `index.html` (link + APP_VERSION), `sw.js` (VERSION), and the one approved line in `styles.css`.
2. **Pass.** Both versions are `'v102-hub'`.
3. **Pass.** The page loads, and the only console error is a 404 for `/favicon.ico`, which happens before this change too. The link points at `./hub.html`. In headless Chrome, clicking it opened `hub.html`, and "Back to app" returned to `index.html`.

**Fit at 375px:** It doesn't fully fit. Nothing runs off the side of the screen, but the date title now wraps to 3 lines ("Friday, / October / 30") instead of 2, so the top bar is 140px tall instead of 110px. "+ Add" was already wrapping onto two lines before this change. As instructed, nothing else was shortened.

**Still to confirm on the phone:** close and reopen the app until Settings shows `v102-hub`, tap Hub, then tap "Back to app".
