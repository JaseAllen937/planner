# Hub: review cards

Oct 31. agentkit now posts reviews (a week, a month, or any stretch) as assistant rows with `data.type = "review"`. The Hub draws them.

- Reads the new `data` column, and drops it from the select (like `files`) when a Supabase hasn't rerun sql/hub_messages.sql yet. The row's text then shows instead, as sections.
- The card has:
  - a header with counts (blocks, focus, a typical night's sleep, to-dos)
  - the tracker grid, block by day, with a key: checked, open, not due, tracker not used
  - focus by day, stacked by focus type
  - sleep by night, 9 PM to 11 AM
  - planner study blocks (done at their time, moved then done, let go, prep)
  - Claude's read
  - up to 3 question buttons that send the question as your message
- Month-long stretches switch to a compact grid and date labels.
- An Updated tag shows when a stretch was posted again after a correction.
- Safety: every number goes through `num()`, every string through `escapeHtml`, and colors only come from the app's palette keys (an unknown key is blue). If a card can't be drawn, the row's text shows instead.
- Checked: headless renders of a week and a month built from agentkit's own output, a question button sending its text, the no-column fallback, and script/img/style payloads in every field (nothing injected, no page errors).
