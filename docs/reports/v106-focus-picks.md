# v106: focus picks report

Commit `2279875` "v106: focus offers only the blocks you pick, sheets match the check-in look", pushed to `main` (Render deploys it). Changed: `index.html` (+68 / −45), `styles.css` (+20, new rules only), `sw.js` (version).

## What changed

**1. Which blocks the start sheet offers**
- A checkbox block can carry an optional `focusOption: true`. If the field is missing, the block isn't offered. There's no migration and no default.
- In block settings, checkbox blocks get one toggle, "Offer when starting focus", under Recurrence. It uses the existing `toggle-row` style, the same one as the Someday and All-day toggles in the add-item sheet. Counter, notes, goal and cycle blocks don't show it.
  - Editing a checkbox block sets `focusOption: true` when the toggle is on and deletes the field when it's off.
  - Creating a checkbox block with the toggle on sets it too. If the toggle was turned on and the type was then switched to something else, the new block doesn't get the field.
- `applyInboxRow` `edit_block` accepts `set.focus_option`:
  - It's allowed only on checkbox blocks. Any other block type gets the existing `invalid field focus_option` reject.
  - It must be a boolean, otherwise the row is rejected with the same note.
  - `true` sets the field and `false` deletes it. If the block already matches, the row returns `already so`. It can be combined with `label` and `recurrence` in one row.

**2. Start sheet: "What are you working on?"**
- It shows only the marked blocks, every day, whether or not they're due or checked. Spaces come in order, then blocks in order.
- They show as tiles that reuse the morning check-in's `.scale` / `.scale-btn` classes, with `.active` on the selected one. The grid has as many columns as tiles, up to 3, then wraps to a new row.
- Labels wrap. A small `.focus-tiles` modifier switches the check-in's monospace digit font to the normal font and lets two-line labels fit.
- There are no to-dos, no space names and no circles.
- Under the tiles there's one text field, with the placeholder "Something else" and no label.
  - Picking a tile clears the field, and typing clears the tile, so the plan is either `{ text: label, ref: { kind: 'block', id } }` or `{ text }`, never both.
  - Tapping the selected tile again unselects it.
- Next comes a full-width primary Start, with a small, centered, grey Skip under it. Start with nothing chosen is the same as Skip.
- With no blocks marked, the tiles are replaced by one muted line (the existing `space-hint` style): "Choose what shows here: turn on Offer when starting focus in a block's settings." The text field still works.

**3. "What did you get done?" sheet**
- If the session had a plan, a muted line reads "Working on: Read" (escaped).
- Then comes a textarea with the placeholder "A line is enough", a full-width Save and the small Skip, laid out like the start sheet.
- The behavior is the same as v105: the session was already saved at End, Save only adds `done`, and any other way of closing the sheet counts as Skip.

**4. Forgotten-session sheet**
- The layout is the question, the date-and-time field, then a full-width "Save with this time".
- Under that, "Still going" and "Discard" sit side by side as smaller grey buttons, with Discard in red text. When "Still going" isn't offered, Discard takes the whole row.
- The behavior is unchanged, including the Discard confirm.

**5. Look:** the sheets use the existing bottom-sheet panel (same padding, radius, grabber and 20 px title) and the existing tokens. New CSS is limited to `.focus-tiles .scale-btn`, `.focus-sheet-plan`, `.focus-sheet-actions`, `.focus-sheet-skip`, `.focus-sheet-pair` and `.focus-sheet-discard`. They add no new colors and no monospace or uppercase text, and every color comes from a variable.

**6. Version:** `VERSION` in `sw.js` and `APP_VERSION` in `index.html` are both `'v106'`.

## Self-check

How I tested: I served the repo with `python3 -m http.server 8000` and drove the real page in headless Chrome at 390 × 844 (fresh profile, Supabase stubbed as in v104/v105). The fixture had:
- in space School: Block 1 (marked), Read (marked, already checked today), School Work (marked, one-off);
- in space Health: Stretch (an unmarked checkbox), a counter and a notes block;
- an open to-do, "Buy stamps", for today.

Result: 40 of 40 assertions passed.

| # | Check | Result |
|---|---|---|
| 1 | The start sheet shows exactly three tiles, "Block 1", "Read" and "School Work", in that order. There is no "Buy stamps", no Stretch, counter or notes block, no space names, no `.space-tick` circles and no field label. | **PASS** |
| 2 | Tap Read: it is `.active`. Type "calc": the tile is cleared, and Start gives `{"text":"calc"}`.<br>Tap Read, type "calc", tap Read again: the field is empty, Read is active, and Start gives `{"text":"Read","ref":{"kind":"block","id":"bRead"}}`.<br>Also checked: Start with nothing chosen leaves no `plan`, and tapping a selected tile again unselects it. | **PASS** |
| 3 | With no blocks marked, there are no tiles and the muted line shows the exact text. Typing "  Essay draft " and tapping Start gives `{"text":"Essay draft"}`. | **PASS** |
| 4 | Stretch's settings show the toggle, off. Turning it on and saving sets `focusOption: true` (also in localStorage). Reopening shows it checked. Turning it off and saving removes the field.<br>Counter and notes settings show no toggle. Creating a checkbox block with the toggle on sets the field, and toggling on then switching the type to counter doesn't. Saving a marked block without touching the toggle keeps it. | **PASS** |
| 5 | `edit_block` with `set: { focus_option: true }` marks Stretch. Applying it again returns `already so` and leaves the state unchanged byte for byte. `false` removes the field, and `false` again returns `already so`.<br>`focus_option` on the counter is rejected with `invalid field focus_option`, and so is `"yes"`; neither changes the state. A combined `label` + `focus_option` row applies both. | **PASS** |
| 6 | Screenshots of the morning check-in, start sheet, got-done sheet and forgotten sheet side by side at 390 × 844, in light and dark (see below). | **PASS** |
| 7 | `git diff --stat`: `index.html`, `styles.css`, `sw.js` only. Both versions read `v106`. Page load: 0 JavaScript errors or exceptions. The only console line was Chrome's automatic `/favicon.ico` 404 (the repo has no favicon), as in v104 and v105. | **PASS** |

Also checked, from v105: under a minute is still not saved. Tapping outside the got-done sheet keeps the session without `done`, and Save adds it. The got-done sheet shows no "Working on" line when there was no plan. "Still going" still sets `stillGoingAt`. The "Working on" line escapes `<b>x</b>`. No `confirm`, `alert` or `prompt` fired in any of the new flows.

**What I compared in the screenshots (check 6):**
- **Tiles:**
  - Same colors as the check-in's mood buttons: the grey inset fill, and the blue fill with white text when active.
  - Same 10 px radius, 15 px semibold text and 6 px gap.
  - The tiles are a little taller than the mood buttons, about 62 px against about 46 px, because they're sized to fit a two-line "School Work". The text is centered on both axes.
- **Fields:** "Something else" and the "A line is enough" textarea use the same inset field as the rest of the app, with placeholder text in the normal font. There are no uppercase mono labels, unlike the check-in's "MOOD" and "ENERGY", as the spec asked.
- **Buttons:**
  - Start, Save and "Save with this time" are full width, sit at the same height on all three sheets, and have the hairline divider above them like `form-actions`.
  - Skip is centered, grey and small.
  - "Still going" and "Discard" are equal halves in grey.
- **Panel:** same padding, radius, grabber and title size on all three. The "Working on: Read" line sits close under the title, in muted 13 px text.

I also looked at:
- the no-blocks-marked start sheet;
- the forgotten sheet without "Still going" (Discard fills the row);
- the block settings with the new toggle, which matches the add-item sheet's toggles.

Nothing looked off, so no fixes came out of the screenshot pass.

**Dark mode:** the app has no dark theme. `styles.css` has no `prefers-color-scheme` rules, and the `theme-color` is the light grey. So the dark-mode screenshots, taken with `prefers-color-scheme: dark` emulated, render the same light sheets, the check-in included. The new CSS uses only the app's variables, so it will follow a dark theme if one is added.

Not verified here: the live pass on the deployed site. Marking blocks by asking the Hub also needs agentkit to send `edit_block` with `set: { focus_option: true }`. The app accepts it now, but the agentkit side (what it offers and how it describes the field) isn't in this repo and wasn't changed.

## Things to know

- A tile's plan text is the block's label at the moment Start is tapped. Renaming the block later doesn't change past sessions' plans; the `ref` still points to the block.
- Marked blocks show every day whether or not they're due or checked, as specified. A deleted block disappears from the tiles, because deleted blocks leave `blocks`.
