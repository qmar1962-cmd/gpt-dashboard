# When to Use Agent Teams — Decision Framework

Help developers choose the right execution model: single session, subagents, or agent teams.

## Quick Decision Flowchart

```
START: What's your task?
├─ Sequential steps, heavy context sharing, same-file edits?
│  └─→ USE SINGLE SESSION ✓
│
├─ Multiple independent subtasks, only care about results?
│  └─→ USE SUBAGENTS ✓
│
└─ Complex work requiring discussion, exploration, or refinement?
   ├─ Parallel investigation or competing approaches?
   │  └─→ USE AGENT TEAMS ✓
   ├─ Collaborative problem-solving?
   │  └─→ USE AGENT TEAMS ✓
   └─ Peer review & iteration before delivery?
      └─→ USE AGENT TEAMS ✓
```

---

## Comparison Table

| **Aspect** | **Single Session** | **Subagents** | **Agent Teams** |
|:---|:---|:---|:---|
| **Context model** | Continuous shared history | One-time spawn with brief context | Rich, multi-turn discussion |
| **Communication** | Single thread | Parent → child (one-way) | Peer-to-peer messaging |
| **Coordination** | Automatic (same context) | Minimal (parent coordinates) | Explicit (meetings, broadcasts) |
| **Token cost** | Single instance | Multiple instances (independent) | Multiple instances (collaborative) |
| **Setup complexity** | None | Low (prompt engineering) | Medium (role definition, delegation) |
| **Best for** | Sequential work, explorations, research | Batch tasks, parallel subtasks | Complex problems, exploration, refinement |
| **Worst for** | Parallel work, peer review | Collaborative problem-solving | Sequential dependencies, simple tasks |
| **Iteration** | Natural (continuous context) | Hard (results only, no refinement) | Easy (teams discuss, refine together) |
| **Debugging** | Single perspective | Parent must debug child failures | Teams can help each other debug |
| **File editing** | Safe (single instance) | OK (different files) | Risky if multiple edit same file |

---

## Concrete Examples

### Example 1: Building a CLI Tool
**Task:** Implement a new command-line tool with validation, error handling, and test coverage.

- **Single session:** ✓ **BEST CHOICE**
  - You'll iterate on the same files repeatedly (main logic, tests, error handling).
  - Requires full context of changes to avoid conflicts.
  - Natural workflow: write feature → run tests → refine.

- **Subagents:** ✗ Not ideal
  - Forces you to write all the logic upfront.
  - Hard to iterate: you'd need to spawn new subagents for fixes.

- **Agent teams:** ✗ Overkill
  - No clear division into parallel tasks.
  - Would require one teammate to wait while another refines code.

---

### Example 2: Content Generation at Scale
**Task:** Generate 50 product descriptions, 20 blog post outlines, and 10 email campaigns.

- **Single session:** ✗ Poor fit
  - Repetitive task; better to parallelize.
  - Context grows unnecessarily large.

- **Subagents:** ✓ **BEST CHOICE**
  - Spawn one for descriptions, one for blog outlines, one for emails.
  - Each finishes independently; you collect results.
  - Low token overhead; no unnecessary communication.

- **Agent teams:** ✗ Overcomplicated
  - No need for discussion between teammates.
  - Teams would waste tokens talking to each other.

---

### Example 3: Designing a System Architecture
**Task:** Design a microservices architecture for a new platform. Need to balance scalability, cost, and team experience.

- **Single session:** ✗ Not ideal
  - Benefits from multiple perspectives.
  - Hard to explore alternatives in a single linear thread.

- **Subagents:** ✗ Not ideal
  - Design requires refinement, not batch execution.
  - Results need discussion before finalization.

- **Agent teams:** ✓ **BEST CHOICE**
  - Spawn: "Scalability expert," "Cost analyst," "DevOps engineer."
  - Teams discuss tradeoffs, challenge each other's assumptions.
  - Lead moderates, asks clarifying questions.
  - Final architecture is refined through dialogue.

---

### Example 4: Debugging a Production Issue
**Task:** Root cause a mysterious latency spike in your API. Need investigation, hypothesis testing, and fixes.

- **Single session:** ✓ **GOOD CHOICE**
  - Sequential investigation (logs → metrics → code).
  - You'll refine hypotheses as you learn.
  - Single context makes it easy to track your thinking.

- **Subagents:** ✗ Poor fit
  - Each subagent would investigate independently without learning from others.
  - Results would overlap and contradict.

- **Agent teams:** ✓ **Also GOOD** (if high stakes)
  - Spawn: "Log analyst," "Metrics engineer," "Code reviewer."
  - Multiple perspectives can find issues faster.
  - Worth the token cost if the outage costs you money.

---

### Example 5: Implementing a Feature with Multiple Moving Parts
**Task:** Add OAuth 2.0 to an existing application (auth service, API client, web UI, docs).

- **Single session:** ✗ Not ideal
  - Hard to handle multiple concerns simultaneously.
  - Risk of losing context as you jump between layers.

- **Subagents:** ✗ Not ideal
  - Each part requires integration and refinement.
  - Can't batch; need to iterate together.

- **Agent teams:** ✓ **BEST CHOICE**
  - Spawn: "Auth service owner," "API client owner," "UI owner."
  - Teams coordinate on interface, share discoveries.
  - Peer review before integration.
  - Final testing with all pieces together.

---

## Cost-Benefit Analysis: When Coordination Overhead Is Worth It

### Calculate Your Cost

```
Team cost = (number of teammates × tokens per teammate) + coordination overhead
Single cost = tokens for single session

Coordination overhead ≈ 15-25% extra tokens for discussions/meetings
```

### Break-Even Scenarios

| **Scenario** | **Single Cost** | **Team Cost** | **Worth teams?** |
|:---|:---|:---|:---|
| 3-hour debug session, high complexity | 5M tokens | 4 teammates × 2M = 8M + 2M overhead = 10M | ✗ No (2x cost) |
| Architectural design, 5-person input | 3M tokens | 3 teammates × 1.5M = 4.5M + 1M overhead = 5.5M | ✓ Maybe (saves rework) |
| 50-page research document | 7M tokens | 4 teammates × 1.5M = 6M + 1.5M overhead = 7.5M | ✓ Yes (parallel) |
| Competing implementation approaches | 4M tokens | 2 teammates × 2.5M = 5M + 0.5M overhead = 5.5M | ✓ Yes (explores both) |

### When Coordination Overhead Pays Off

1. **Parallel exploration** — Teams work on different tasks simultaneously (token cost saved beats coordination cost).
2. **Risk mitigation** — Multiple perspectives catch issues early (saves rework later).
3. **Peer review** — Catch bugs before deployment (saves cost of production fixes).
4. **Complex decisions** — Requires discussion, not just computation (single session would be slower).

### When Overhead Is Wasted

1. **Simple, sequential work** — Single session handles it naturally.
2. **Batch tasks** — Use subagents (spawn, collect, done).
3. **Small scope** — Coordination overhead exceeds problem complexity.
4. **Tight deadlines** — Coordination adds latency; single session is faster.

---

## Red Flags: Don't Use Teams

### 🚩 Same-File Editing
**Problem:** Two teammates modifying the same file without coordination leads to conflicts.

**Fix:** Use a single session, or strictly assign file ownership (one teammate per file).

```
Lead's note in spawn prompt:
"You own: src/auth.ts, src/auth.test.ts
Your teammate owns: src/middleware.ts
Never edit outside your files."
```

### 🚩 Heavy Sequential Dependencies
**Problem:** Teammate B can't start until Teammate A finishes; you're not gaining parallelism.

**Example:** Teammate A writes schema → Teammate B writes migrations → Teammate C writes ORM models.

**Fix:** Use a single session and iterate as you go.

### 🚩 Simple, Short Tasks
**Problem:** Coordination overhead dwarfs the actual work.

**Example:** "Add a button to the navbar" shouldn't require a team.

**Fix:** Use a single session or subagent.

### 🚩 Very Similar Tasks
**Problem:** Teammates will converge on the same solution; discussion adds no value.

**Example:** Generate 100 JSON fixtures (all following the same pattern).

**Fix:** Use a single session or subagents (not teams).

### 🚩 Require Merged Changes to Same File
**Problem:** Impossible to avoid conflicts.

**Example:** Two teammates both adding new utility functions to `utils.ts`.

**Fix:** Single session, or refactor into separate modules (one teammate per module).

---

## Decision Tree: By Task Characteristics

| **Task Characteristic** | **Decision** | **Reason** |
|:---|:---|:---|
| Straightforward, linear steps | Single session | No parallelism needed |
| Multiple independent batch tasks | Subagents | Parallel execution, no interaction |
| One large task, needs exploration | Single session | Continuous refinement |
| Competing approaches to explore | Agent teams | Parallel investigation + discussion |
| Requires peer review & refinement | Agent teams | Built-in collaboration |
| Specialists needed to collaborate | Agent teams | Different perspectives help |
| Everything to same one or two files | Single session | Conflict avoidance |
| Different files, no interaction | Subagents | Cost efficiency |
| Different files, frequent discussion | Agent teams | Natural communication |
| Tight latency requirements | Single session | No coordination overhead |
| Tight token budget | Single session | No duplication |
| Learning/exploration is the goal | Single session | Continuous learning |
| Shipping working code is the goal | Agent teams | Peer review catches issues |

---

## Summary

- **Single session:** You, iterating and exploring. Natural, no overhead, best for sequential work and learning.
- **Subagents:** You, delegating independent batch tasks. Most efficient for parallel production work.
- **Agent teams:** You + specialists, discussing and refining. Best for complex problems, peer review, and risk mitigation.

**Default:** Start with a single session. Graduate to teams only when you clearly need collaboration or parallel exploration.
