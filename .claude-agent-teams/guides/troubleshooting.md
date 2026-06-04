# Troubleshooting Agent Teams

Common issues, symptoms, and fixes.

## Teammates not appearing

**Symptom:** You asked Claude to create a team but no teammates show up.

**Fixes:**

- In in-process mode, teammates may be running but not visible. Press `Shift+Down` to cycle through them.
- Claude may have decided your task doesn't warrant a team. Be explicit: "Create an agent team with N teammates."
- If using split panes, verify tmux is installed and in your PATH:
  ```bash
  which tmux
  ```
- For iTerm2: confirm the `it2` CLI is installed and the Python API is enabled (iTerm2 → Settings → General → Magic → Enable Python API).

## Too many permission prompts

**Symptom:** Teammates keep bubbling up permission requests, stalling work.

**Fix:** Pre-approve common operations in your [permission settings](../config/permissions.md) before spawning the team. This is the single biggest quality-of-life improvement for team workflows.

## Teammates stopping on errors

**Symptom:** A teammate hits an error and stops instead of recovering.

**Fixes:**

- Select the teammate (`Shift+Up/Down` in in-process, or click the pane in split mode).
- Give them instructions to retry or work around the error.
- If unrecoverable, tell the lead to spawn a replacement and reassign the task.

## Lead implements instead of delegating

**Symptom:** The lead starts coding instead of waiting for teammates to finish.

**Fixes:**

- Tell the lead explicitly: "Wait for your teammates to complete their tasks before proceeding."
- Enable delegate mode (`Shift+Tab`) to restrict the lead to coordination-only tools.

## Lead shuts down too early

**Symptom:** The lead declares the team finished while tasks are still in progress.

**Fix:** Tell the lead to keep going. You can also preempt this in your initial prompt: "Do not finish until all teammates have completed their tasks and reported back."

## Task status is stale

**Symptom:** A task appears stuck as "in progress" even though the work is done.

**Cause:** Teammates sometimes fail to mark tasks as completed, which blocks dependent tasks.

**Fix:** Check if the work is actually done. If so, tell the lead to update the task status or nudge the teammate to mark it complete.

## Orphaned tmux sessions

**Symptom:** tmux sessions persist after the team ends.

**Fix:**

```bash
tmux ls
tmux kill-session -t <session-name>
```

## Session resume doesn't restore teammates

**Symptom:** After using `/resume` or `/rewind`, the lead tries to message teammates that no longer exist.

**Cause:** In-process teammates are not restored on session resume. This is a known limitation.

**Fix:** Tell the lead to spawn new teammates and reassign incomplete tasks.

## File conflicts between teammates

**Symptom:** One teammate's changes overwrite another's.

**Cause:** Two teammates edited the same file. Agent teams use file locking for tasks but not for file edits.

**Prevention:**

- Assign clear file ownership boundaries in your prompt and CLAUDE.md.
- Use a [CLAUDE.md template](../templates/claude-md/) that enforces file ownership rules.
- Break work so each teammate owns a distinct set of files.

## Known limitations

These are current constraints that cannot be worked around:

- **One team per session.** Clean up before starting a new one.
- **No nested teams.** Teammates cannot spawn their own teams.
- **Lead is fixed.** You can't promote a teammate or transfer leadership.
- **Permissions set at spawn.** All teammates start with the lead's mode. You can change individual modes after, but not at spawn time.
- **Split panes need tmux or iTerm2.** Not supported in VS Code terminal, Windows Terminal, or Ghostty.
