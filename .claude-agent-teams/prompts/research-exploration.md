# Research & Exploration — Multi-Angle Design Exploration

Explore a problem from multiple angles before committing to a design. Teammates investigate different perspectives, debate trade-offs, and synthesize into a recommendation.

## Prompt

Copy-paste this into Claude Code. Replace the [bracketed text] with your specifics.

---

Create an agent team to explore [describe what you're designing or deciding on].

Read the codebase to understand existing architecture, constraints, and conventions.

Spawn 3 teammates to explore different perspectives:

- Architect: Design a system approach addressing [key requirements]. Consider modularity, scalability, maintainability. 5-6 tasks: identify constraints, sketch architecture, evaluate trade-offs, propose concrete structure, document assumptions, prepare for debate.

- Skeptic/Critic: Challenge the Architect's approach. Find failure modes, edge cases, scalability concerns, and costs. 5-6 tasks: identify risks, propose boundary cases, check against requirements, find hidden assumptions, propose alternatives, prepare counter-arguments.

- Pragmatist/Prototyper: Explore the riskiest technical assumptions with a quick proof of concept or deeper investigation. 5-6 tasks: identify risky assumptions, research feasibility, build a quick prototype or spike, test assumptions, document findings, prepare recommendations.

Have them work independently for their perspective. When all three finish, have them debate findings — the Architect and Skeptic should challenge each other while the Prototyper settles disagreements with concrete evidence.

Synthesize their debate into a final recommendation that addresses concerns and proposes a path forward.

---

## What happens

Three teammates explore the same problem from different angles. Architect builds a proposal, Skeptic pokes holes in it, and Pragmatist gathers evidence to settle disagreements. The resulting recommendation is more robust because it's been stress-tested.

## Tips

- Start with research teams if you're new to agent teams — they have clear boundaries and low risk of breaking things
- The Skeptic/Devil's Advocate role is essential. Without it, teammates tend to agree too quickly
- Ask for a "comparison matrix" or "trade-off table" to get structured output rather than prose
- Research and exploration use fewer tokens than implementation, making them good practice for learning the workflow
