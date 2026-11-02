# v110: People and the Sunday review from the Hub (Nov 2)

Ask: "a people bot that I can talk to about the people I have talked to ... store the persons name and a brief about them in a bank automatically and transfer info to the memory bot and reviews" and "expand the review bot where I would normally fill in the blanks every sunday ... directly through the hub".

## App (index.html)
New agent_inbox ops, applied by applyInboxRow with the same rules as the app's own forms:
- **People:**
  - `add_person` {name <=80, about <=240}. The person gets the op's id.
  - `edit_person` {person_id, set: name/about}
  - `log_contact` {person_id, date (up to 60 days back), recap <=2000, note <=400}. Lands in the People room and the Sunday review's social list.
  - `edit_contact`, `delete_contact` (tombstoned)
  - `restore_contact`, `delete_person` (only Undo sends these). delete_person leaves someone who still has conversations.
- **Sunday review:**
  - `set_review` {date (up to 7 days back), set: q1..q5/social}. Upserts that night-date's review and only touches the answers given; a new review gets the op's id.
  - `delete_review` (Undo of a new one)
- applyAgentInbox: rows sent together share created_at, so ties run add_person first and delete_person last.
- The new ops join the retry list, so an older copy that turned them away gets them applied after the update.
- The People room re-renders when the inbox changes it.

## Hub (hub.html)
- Change cards draw the new lines: a person, "Talked with ...", a Sunday review saved, and removals.
- Review cards get a People section (conversations, people, names).
- The question buttons show on every card, so a thin week still has "Do my Sunday review".

## Checked
- 33 headless checks of the new ops: apply, repeat, bad input, tombstones, the review social list, the Today card, batch order both ways, and the People room rendering. All pass.
- 6 app mutations, all caught.
- The Hub's earlier function and XSS checks give the same results as before.
