---
description: Operate the model-routing seats: report where they stand, pin or free a seat, or turn routing off
argument-hint: [status|dynamic|inherit|set <stage> <model|dynamic>]
---

Operate the model-routing switch. Routing is delegation-based: stage work goes to four subagents at `~/.claude/agents/`: `Explore.md`, `Plan.md`, `Execute.md`, `Review.md`. Every seat is DYNAMIC by default, resolved when a spawn is about to happen: no seat ever runs above the session's own tier, Plan and Review ride the session tier exactly, Explore resolves to haiku (the floor), and Execute runs sonnet capped at the session tier (callers on stronger sessions pass `model: sonnet` at spawn). A pin set through this command overrides the dynamic rule for that seat, verbatim.

Each file carries the live `model:` value and the seat memory (`<!-- Seat: X -->` near the end of the body): `dynamic`, or a pinned model. A dynamic seat's live value is `model: haiku` for Explore and `model: inherit` for the other three.

`$ARGUMENTS` is one of `status` (default when empty), `dynamic`, `inherit`, or `set <stage> <model|dynamic>`.

**status**: Read both values in all four files and report each seat (dynamic, or pinned to which model), the position (`dynamic` when every seat memory reads dynamic, `inherit` when all four live values read `inherit`, MIXED otherwise), and what the dynamic seats resolve to for THIS session given its model. Change nothing. Never tell the user to change their session model; the switch reads it, never sets it.

**dynamic**: Resume routing per the seat memories with the Edit tool: a seat remembering `dynamic` gets its dynamic live value (Explore `model: haiku`, others `model: inherit`); a seat remembering a pin gets that pin back. Report what changed.

**inherit**: Routing off. Set all four live `model:` values to `inherit`, leaving every seat memory untouched (the memory is what a later `dynamic` restores). Every stage then follows the session model.

**set <stage> <model|dynamic>**: `<stage>` is one of explore, plan, execute, review. `set <stage> dynamic` returns that seat to the dynamic rule (memory `dynamic`, live value per the mapping above). `set <stage> <model>` with a model tier your harness accepts (for example haiku, sonnet, opus) pins the seat: update the memory, and unless the position is currently `inherit`, set the live value to match. Never accept `inherit` as a seat value; it is a position, not a seat. Reject anything else with the valid options. Warn once when pinning a premium tier: premium spawns run without an approval prompt, so the cost surfacing is the seat's own self-report line, after the fact. A pin is honored verbatim, even above the session tier; an explicit choice is the user's to make.

Notes, state them when relevant rather than dumping them every run:
- New agent files hot-register mid-session, and live-value edits apply to the next spawn without a restart. The one exception: same-named overrides of built-ins (Explore, Plan) apply from the next session start.
- `CLAUDE_CODE_SUBAGENT_MODEL` is never part of this switch; it is the emergency cost ceiling only, since it flattens every subagent to one model.
