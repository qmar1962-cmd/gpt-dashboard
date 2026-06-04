# Agent Team Conventions

This project uses Claude Code agent teams. Every teammate reads this file automatically.

## The one rule

**No two teammates edit the same file.** Before starting work, declare which files you own. If another teammate owns a file, do not edit it — message them instead.

## File ownership

When the lead assigns you work, declare your file ownership in the task list. Example:

```
I own: src/auth/*.ts, tests/auth/*.ts
I will NOT touch: src/api/*, src/frontend/*
```

The lead resolves conflicts. If you need a change in a file you don't own, message the teammate who does.

## Code standards

- Follow existing patterns in the codebase. Read 2-3 existing files before writing new ones.
- Match the project's naming conventions, formatting, and directory structure.
- Write tests for new functionality. Place tests next to the code they test or in the existing test directory.
- Don't introduce new dependencies without checking with the lead.

## Communication

- Report progress when you complete a task or hit a blocker.
- If you need input from another teammate, message them directly.
- If you change a contract, interface, schema, or shared type, notify every affected teammate.
- If you're unsure about a design decision, ask the lead before implementing.
- When done, summarize what you built, what files you touched, and any follow-up items.

## Task workflow

1. Read this file and the codebase to understand the project.
2. Claim your assigned task from the task list, or self-claim the next unblocked task if the lead allows it.
3. Declare file ownership.
4. Check task dependencies before you start. If you're blocked, report the exact blocker and owner.
5. Implement, test, and verify.
6. Mark the task complete only after verification and any required teammate notifications.
7. Report completion, files touched, and risks to the lead.
