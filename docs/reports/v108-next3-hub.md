# v108: Next 3 days and Hub recaps

Oct 31. Plans now add deadlines, prep, and study blocks, and the Next 3 days card and the Hub's plan posts had turned into walls of same-looking lines.

## Next 3 days (index.html, styles.css)
- Each day opens with a strip of the waking day (8am to midnight): study blocks the planner added are blue capsules, his own events graphite, anything due a red diamond at the day's end. Today shows a "now" line, with the part of the day already gone hatched. It redraws once a minute while the app is open.
- Rows use the same markers, in one order: due, all-day, timed by start, loose to-dos; finished things last, faded and struck through; blocks already over today faded. Durations on the right. Titles up to 2 lines. "Unit 3 Quiz due" shows as "Unit 3 Quiz" under a red Due label.
- Study blocks are recognised by the planner's note ("(Plan: X. Movable.)"), due items by high priority on a to-do. Nothing new is stored. Today's rows stay tappable, now also by keyboard.
- APP_VERSION and sw.js VERSION are v108.

## Hub (hub.html)
- Plan posts get a header (source, deadlines / prep / study block counts, rounds). Lines become paragraphs, "Heading:" plus "- item" lines become sections, sections over 5 items fold ("Show N more"), "Left out" is quiet, "Couldn't place" / "No study time" are red, and "Check these dates" is a blue box with each date as a chip and the question at the bottom.
- Change cards ("#12 Added to your schedule (39 changes)") list the changes by day with the same markers, fold after 6 ("Show all 39"), keep the "Plan: ..." line as a footnote, and the Undo button is a quiet pill.
- "From a Claude chat:" hand-offs are a dashed note instead of a chat bubble.
- New rows rise in once (not on first load), the list follows a new reply down smoothly, and the working line is a typing indicator. Reduced motion turns both off.
- The composer starts one line tall (a global textarea min-height made it 80px).
- Everything still goes through formatAssistant (escape first); checked with script and img payloads in both parsers.

## Checked
Rendered at 390px with real plan text from today (before/after screenshots), folding and unfolding, a new row arriving by poll, Undo posting {role: button, body: un:12, ref_id}, and no page errors.

## Hub, part 2: every other message type
- Change cards of every kind read as rows with markers: moved (arrow, "Moved to Thu, Nov 5, 4pm"), removed (struck through), brought back, checked off (green check, with the space), marked done, logged. A single dated change still shows its day.
- "Undid #N" is a card with the same rows instead of a raw list.
- /today is a card: events with times, to-dos with what's done underneath, the tracker as 9 pips with "5 of 9 checked", what's still open by space, then logged, focus, sleep.
- The memory bot's post shows profile changes as New / Changed / Removed tags (a removed fact used to look like a bullet point).
- An approval to send an email shows To, Subject, and the text, with Approve and Deny; other tool approvals show the input in a code box.
- "[focus] didn't run", "The schedule job failed", "Couldn't ..." get a red "Needs a look" outline.
- Checked again: folding, a new row arriving, Undo, escaping in every new parser, no page errors.
