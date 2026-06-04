# Quickstart — Your First Agent Team

The simplest possible team for trying agent teams. 2 teammates work independently on your task.

## Prompt

Copy-paste this into Claude Code. Replace the [bracketed text] with your specifics.

---

I need help with [describe your task here].

Read the codebase to understand the current structure. Then spawn 2 teammates:

- Teammate 1: [first responsibility or angle]
- Teammate 2: [second responsibility or angle]

Have them work independently for 5-6 tasks each. When done, they should report their findings and I'll synthesize the results.

---

## What happens

1. Claude reads your codebase and CLAUDE.md automatically
2. Two teammates spawn in separate context windows with full codebase access
3. Each teammate works on their assigned area independently
4. You can message either teammate with follow-ups
5. Teammates can be asked to share findings with each other
6. The lead coordinates and synthesizes the final output

## Tips

- Be specific about what each teammate should do — vague tasks lead to wasted cycles
- Use this template to get comfortable with the team interface before trying more complex scenarios
- You can switch between teammates using Shift+Up/Shift+Down to monitor progress
- Ask teammates to record findings in a shared doc or structured list so synthesis is easy
