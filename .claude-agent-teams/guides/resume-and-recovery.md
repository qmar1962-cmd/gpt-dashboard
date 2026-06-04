# Resume and Recovery for Agent Teams

Agent teams are fast when they stay healthy. When they do not, recover them deliberately instead of guessing.

This guide is the playbook for stalled tasks, broken resumes, and half-alive teams.

## Known limitation to plan around

In-process teammates are not restored by `/resume` or `/rewind`.

That means the lead may wake up believing teammates still exist even when they do not. When that happens, do not keep sending messages into the void. Rebuild the team state intentionally.

## Recovery sequence

When a session resumes badly, use this order:

1. Audit what is actually finished
2. Identify stale or blocked tasks
3. Respawn only the teammates you still need
4. Reassign unfinished work with explicit ownership
5. Shut down and clean up old team state when safe

## Resume playbook

Tell the lead something like this:

```text
The session was resumed and any in-process teammates may be gone.
Audit the task list, identify which tasks are truly complete, respawn only the
missing teammates we still need, and reassign unfinished work.
```

That prompt usually gets the lead back into an operational mindset instead of assuming the old team still exists.

## How to audit tasks quickly

For each task, ask:

- Is the deliverable actually present?
- Did the owner report completion, or only partial progress?
- Are dependent tasks blocked because status never updated?
- Did another teammate already consume the output successfully?

If the work exists but the task is stale, update the task status and move on.
If the work does not exist, reassign it as a fresh task.

## When teammates stop on errors

If a teammate stopped after a failed command or bad assumption:

- inspect the failure
- decide whether the same teammate can continue with new guidance
- if not, spawn a replacement and give them the exact remaining scope

Good recovery prompt:

```text
The previous teammate stopped on an error. Spawn a replacement teammate,
give them the remaining scope only, and include the failure context so they
do not repeat the same path.
```

## When task status lags behind reality

This is common enough to plan for.

If a dependency is blocked but the work is already done:

- verify the artifact exists
- mark the earlier task complete through the lead
- explicitly tell the blocked teammate the dependency is ready

Do not wait for the system to self-heal if the state is obviously wrong.

## When the lead finishes too early

Sometimes the lead decides the team is done while tasks are still active.

Correct it directly:

```text
Do not finish yet. Wait for every active teammate to either complete, hand off,
or explicitly shut down. Then synthesize the remaining results.
```

If the lead keeps implementing instead of coordinating, toggle delegate mode and push it back into orchestration.

## When split panes or tmux are orphaned

If a team ended messily and panes remain:

```bash
tmux ls
tmux kill-session -t <session-name>
```

Only do manual cleanup after you are sure there is no teammate work left to preserve.

## When to respawn versus restart from scratch

### Respawn missing teammates when

- most of the task graph is still valid
- only one or two teammates were lost
- artifacts and ownership are still clear

### Restart the team when

- task ownership is confused
- many tasks are stale or contradictory
- multiple teammates edited overlapping areas
- the lead no longer has a trustworthy picture of reality

## Minimal evidence teammates should leave behind

Require each teammate to leave:

- files touched
- task IDs completed
- verification run
- open risks or blockers

That evidence makes recovery much cheaper because another teammate can pick up the work without re-exploring everything.

## Recovery checklist

- [ ] Confirm whether resumed teammates actually still exist
- [ ] Audit task status against real artifacts
- [ ] Fix stale completed tasks so dependencies unblock
- [ ] Respawn only the teammates you still need
- [ ] Reassign unfinished work with explicit file ownership
- [ ] Ask active teammates to summarize before going idle
- [ ] Shut down teammates before cleanup
- [ ] Clean up through the lead only

## Strong default habit

Treat every team as resumable by design:

- keep tasks explicit
- keep ownership narrow
- keep summaries frequent
- keep recoverable artifacts visible

Teams that leave clean traces are much easier to optimize over time.
