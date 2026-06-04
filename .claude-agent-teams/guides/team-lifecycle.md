# Agent Team Lifecycle

The complete flow from creating a team to cleaning up, with commands and decision points at each stage.

## 1. Setup

**Enable the feature:**

```json
// ~/.claude/settings.json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

**Prepare your repo** (optional but recommended):

- Drop a [CLAUDE.md template](../templates/claude-md/) into your repo root with file ownership rules and project context.
- Pre-approve common permissions in [settings](../config/permissions.md) to reduce friction during execution.

## 2. Create the team

Tell Claude what you need. Be specific about team structure, or let Claude decide:

```
Create an agent team to {{ task }}.
Spawn {{ N }} teammates:
- {{ role 1 }}: {{ scope }}
- {{ role 2 }}: {{ scope }}
```

**Decision: plan approval?** For risky or complex work, require teammates to plan before implementing:

```
Require plan approval before any teammate makes changes.
Only approve plans that {{ criteria }}.
```

**Decision: delegate mode?** If you want the lead to coordinate only (no coding), press `Shift+Tab` after the team is created.

## 3. Monitor progress

| Action | In-process mode | Split-pane mode |
|:---|:---|:---|
| See all teammates | Lead terminal output | All panes visible |
| Select a teammate | `Shift+Up/Down` | Click the pane |
| View task list | `Ctrl+T` | `Ctrl+T` in lead pane |
| Message a teammate | Select + type | Type in their pane |

**What to watch for:**

- Teammates working on the wrong thing → message them directly with corrections.
- Lead implementing instead of delegating → say "wait for teammates" or enable delegate mode.
- Task status appearing stale → nudge the teammate or update manually through the lead.
- Permission prompts piling up → consider pre-approving in settings for next time.

## 4. Steer and adjust

You can intervene at any point:

**Redirect a teammate:**
```
Tell the frontend teammate to stop working on the sidebar
and focus on the auth form instead.
```

**Add a teammate mid-session:**
```
Spawn a new teammate to handle the database migrations.
Assign them tasks 4 and 5.
```

**Reassign work:**
```
The reviewer teammate is stuck. Shut them down and reassign
their remaining tasks to a new reviewer.
```

**Broadcast to all:**
```
Tell all teammates: the API contract has changed.
The new endpoint is POST /v2/sessions instead of POST /v1/auth.
```

Use broadcast sparingly — it costs tokens proportional to team size.

## 5. Synthesize results

After teammates finish, the lead should consolidate:

```
All teammates have finished. Synthesize their findings into
a single summary with recommendations.
```

For implementation teams, you may want a verification step:

```
Have each teammate verify that their work integrates correctly
with the other teammates' output. Run the full test suite.
```

## 6. Shut down teammates

Shut down teammates before cleanup. Each teammate can approve or reject:

```
Ask all teammates to shut down.
```

Teammates finish their current operation before exiting, so this may take a moment.

## 7. Clean up

Always clean up through the lead (never through a teammate):

```
Clean up the team.
```

This removes shared team resources (config, task list). Cleanup fails if teammates are still running — shut them down first.

**If tmux sessions persist:**

```bash
tmux ls
tmux kill-session -t <session-name>
```

## Lifecycle at a glance

```
Setup → Create team → [Plan approval?] → Teammates work
    ↓                                         ↓
Configure CLAUDE.md                    Monitor & steer
Pre-approve permissions                Redirect / add / reassign
                                              ↓
                                    Synthesize results
                                              ↓
                                    Shut down teammates
                                              ↓
                                       Clean up team
```
