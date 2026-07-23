---
description: Flip the model-routing switch between tiered and inherit, set a stage's seat model, or report where it stands
argument-hint: [tiered|inherit|status|set <stage> <model>]
---

Operate the model-routing switch. Routing is delegation-based and independent of the main session's model: the session orchestrates on whatever model the user picked, and stage work goes to four pinned subagents at `~/.claude/agents/`: `Explore.md`, `Plan.md`, `Execute.md`, `Review.md` (installed from this toolbox's agents entries via the installer; plugin-scoped agents cannot take the built-in Explore and Plan names, so the installer route is the one that makes the switch work).

Each file carries two values: the live pin (`model:` in frontmatter) and the seat (`<!-- Tiered seat: X -->` near the end of the body). The seat is the remembered tiered value; the pin is what runs. Seat defaults: Explore haiku, Plan opus, Execute sonnet, Review opus. Plan and Review are the user-chosen strong seats; pin them to the strongest tier you pay for if you want the strongest judge on the bookends.

`$ARGUMENTS` is one of `tiered`, `inherit`, `status` (default when empty), or `set <stage> <model>`.

**status**: Read both values in all four files and report: position `tiered` when every pin equals its seat, `inherit` when all four pins read `inherit`, MIXED (per-file values) otherwise; plus each seat. Do not change anything. Never tell the user to change their session model; it is not part of the switch.

**tiered**: Set each file's `model:` to that file's seat value with the Edit tool, then report what changed.

**inherit**: Set all four files' `model:` to `inherit` with the Edit tool, leaving every seat line untouched (the seats are the memory that a later `tiered` restores), then report that every stage will follow the session model.

**set <stage> <model>**: `<stage>` is one of explore, plan, execute, review; `<model>` is a model tier your harness accepts (for example haiku, sonnet, opus) - never `inherit`, which is a position, not a seat (reject it and point at `/model-routing inherit`). Update that file's seat line to the new model, and unless the file's pin currently reads `inherit`, set the pin to match. Reject anything else with the valid options. Warn once when a seat is set to a premium tier: unless your settings carry an ask rule for it, premium spawns run without an approval prompt, so the cost surfacing is the agent's own self-report line, after the fact.

Notes, state them when relevant rather than dumping them every run:
- New agent files hot-register mid-session, and pin edits apply to the next spawn without a restart. The one exception: same-named overrides of built-in agents (Explore, Plan) apply from the next session start.
- `CLAUDE_CODE_SUBAGENT_MODEL` is never part of this switch; it is the emergency cost ceiling only, since it flattens every subagent to one model.
- An alias session model that plans strong and executes cheaper (where your harness offers one) is an optional convenience on top, never required by the switch.
