# Claude Agent Teams Project Harness

This local harness was installed by `npx claude-agent-teams init`.

## Pack

- **Name:** Starter
- **Focus:** Fastest path to a reliable first team, with launch, recovery, and quality-gate guides.

## Fast start

1. Update the root `CLAUDE.md` with real file ownership and project context.
2. Run `npx claude-agent-teams validate` before launching a team.
3. Start with one of these prompts:
- `prompts/quickstart.md`
- `prompts/research-exploration.md`
4. Use the guides in this folder when the team stalls, drifts, or needs stronger quality gates.

## Recommended operating loop

1. Pick the smallest team that still gives you real parallelism.
2. Define 5-6 tasks per teammate, with dependencies called out explicitly.
3. Require plan approval for risky contracts, schema changes, or auth work.
4. Wait for teammates to finish instead of letting the lead do implementation.
5. Shut down teammates, then clean up through the lead.

## Included guides

- `guides/when-to-use-teams.md`
- `guides/team-lifecycle.md`
- `guides/troubleshooting.md`
- `guides/quality-gates.md`
- `guides/resume-and-recovery.md`

## Notes

- The root `CLAUDE.md` is the source of truth for ownership rules.
- This harness is safe to commit if your team wants shared workflows.
- Re-run `init --force --harness=starter` to refresh these files later.
