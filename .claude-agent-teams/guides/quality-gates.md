# Quality Gates for Agent Teams

Use quality gates to keep teammates productive without letting bad work slip through.

Official agent-team docs call out two hooks that matter most:

- `TeammateIdle` - runs when a teammate is about to go idle
- `TaskCompleted` - runs when a task is about to be marked complete

If a hook exits with code `2`, it can send feedback and keep the work in progress instead of allowing a silent failure.

## Where quality gates help most

- Critical contracts: auth, schemas, public APIs, shared types
- Expensive integration paths: cross-layer features, migrations, performance work
- Teams with junior or highly specialized roles where review quality can drift
- Long-running tasks where the lead needs intermediate evidence, not just a final answer

## Gate 1: Before a teammate goes idle

Use `TeammateIdle` to stop teammates from quietly parking with half-finished work.

Ask the hook to verify that the teammate includes:

- what they completed
- which files they touched
- what they tested or verified
- what is still blocked or risky
- who else needs to know about interface changes

### Good idle-gate questions

- Did the teammate run the relevant tests, lint, or build step?
- Did they update the task state accurately?
- If they changed a contract, did they notify affected teammates?
- If they are blocked, did they clearly name the blocker and owner?

### Example feedback to send back

```text
Don't go idle yet. Report the files you changed, the tests you ran, and
whether the frontend teammate needs to adjust to the API contract change.
```

## Gate 2: Before a task is marked complete

Use `TaskCompleted` to prevent teams from marking tasks done too early.

This gate is strongest when tasks have explicit deliverables.

### Good completion checks

- Acceptance criteria are satisfied
- Required verification ran and passed
- Dependencies or follow-up tasks were created if needed
- File ownership was respected
- Output is ready for another teammate to consume

### Example feedback to send back

```text
This task is not complete yet. The task requires integration verification
against the shared contract and a note to the backend owner if the response
shape changed.
```

## Recommended default gates

These are good defaults for most teams:

### For implementation teams

- Block task completion if no tests or verification are reported
- Block idle state if files changed but no summary is provided
- Block completion if a public interface changed without notifying affected teammates

### For research and review teams

- Block completion if findings do not include evidence or tradeoffs
- Block idle state if recommendations do not say what to do next
- Block completion if risks are listed without severity or mitigation

### For debugging teams

- Block completion if the hypothesis is not supported by concrete evidence
- Block completion if competing theories were not ruled out
- Block idle state if logs, traces, or reproduction steps are missing

## Pair hooks with plan approval

Hooks work best with plan approval on critical paths.

Use plan approval for:

- database schema changes
- authentication or authorization changes
- shared API contracts
- changes that affect multiple teammates

Then use hooks to enforce execution quality after the plan is approved.

## What to put in tasks so hooks can judge correctly

Hooks are only as good as the task definitions they inspect. Make tasks explicit.

Each task should include:

- clear acceptance criteria
- owned files or file boundaries
- dependencies
- expected verification
- who consumes the output next

## Lightweight operating model

1. Lead creates clear tasks with deliverables and dependencies.
2. Risky work requires plan approval before implementation.
3. `TaskCompleted` blocks weak completions.
4. `TeammateIdle` blocks silent drift.
5. Lead reviews only the high-signal summaries, not every keystroke.

## Failure modes to avoid

- Over-gating tiny tasks until teammates spend more time satisfying hooks than doing work
- Vague tasks that force hooks to guess what “done” means
- Blocking everything through the lead instead of letting teammates coordinate directly
- Using hooks as punishment instead of fast feedback

## Practical starter policy

If you only adopt three gates, start here:

1. No task completes without verification evidence.
2. No teammate goes idle without a summary of files, tests, and blockers.
3. No contract change completes without notifying affected teammates.

That small policy catches a large share of wasted effort.
