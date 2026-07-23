# Toolbox

Small, portable tools for Claude Code: skills, commands, hooks, and agents pulled from real daily use, packaged so you can install one in seconds and own it.

Each entry is small and does one thing. They install by copying into your Claude Code config, carry no lock-in, and work with whatever model you run. Read them, change them, keep what is useful.

## Quickstart

```
npx @jayofemi/toolbox
```

That lists everything and installs the ones you pick into `~/.claude/`. To grab one directly:

```
npx @jayofemi/toolbox add screenshot
```

Run `npx @jayofemi/toolbox list` to see the catalog without installing.

## What is inside

Four kinds of entry, split by how they run:

- **Commands** are slash commands you invoke by name, like `/screenshot`. They install to `~/.claude/commands/`.
- **Skills** are ones Claude reaches for on its own when a task matches their description, and you can invoke them by name too. They install to `~/.claude/skills/`.
- **Hooks** are scripts your Claude Code config runs mechanically at fixed moments (a reply finishing, a prompt arriving). They install to `~/.claude/hooks/`, and the installer prints the one settings block that wires them; new hooks apply from your next session.
- **Agents** are subagent definitions with a pinned model tier. They install to `~/.claude/agents/`; new agents register mid-session, and overrides of built-in names (Explore, Plan) apply from your next session start.

### Commands

- **[screenshot](commands/screenshot.md)**: save a slice of the conversation. A good exchange is easy to lose once a session moves on or compacts, so `/screenshot` writes the last N prompt-and-reply pairs, with the model that produced them, to a timestamped file in `captures/`. The useful parts are kept verbatim.
- **[startup](commands/startup.md)**: open a session cleanly. Stamps today's date so the agent stops guessing it, then reads the project's context files and confirms where things stand.
- **[ask-model](commands/ask-model.md)**: ask a chosen model a question. `/ask-model haiku What changed in this file?` delegates to a subagent on that model and returns its answer, leaving your own session on its model.

### Skills

- **[wording](skills/wording/SKILL.md)**: lint user-visible text before it ships. Catches em and en dashes, AI-tell constructions, "copy" misused for site text, and jargon on non-technical surfaces, pairing a zero-dependency detector with judgment for the calls a regex cannot make.
- **[gatekeeper](skills/gatekeeper/SKILL.md)**: scan a repo for secrets and private info before you make it public. Catches keys, tokens, private keys, leaked local paths, and configurable deny terms, with a zero-dependency detector.
- **[reroute-task](skills/reroute-task/SKILL.md)**: run a task on a chosen model. `/reroute-task haiku <task>` hands the work to a subagent on that model and reports back, so your main session keeps its model and only the delegated work runs on the cheaper one.

### Hooks

- **[token-report](hooks/token-report.mjs)**: see what every turn cost. Totals each turn's token spend, subagents included, prints it as a system line, and appends a daily ledger under `~/.claude/token-ledger/`. A reporter, never a gate.
- **[token-handoff](hooks/token-handoff.mjs)**: the same count, surfaced inside the next reply, for apps that do not render system lines. Pairs with token-report.
- **[reply-gate](hooks/reply-gate.mjs)**: keep replies readable. Bounces a final reply over the prose-length ceiling once, with the exact word count, then always passes the revision. Default 300 words; `REPLY_GATE_MAX_WORDS` overrides.

### Agents (the model-routing switch)

Four subagent seats, dynamic by default: nothing ever runs above your session's own tier, **Plan** and **Review** ride the session tier exactly (the bookends get the strongest model you are already paying for), **Explore** stays on cheap Haiku for sweeps, and **Execute** runs Sonnet capped at the session tier for spec-driven edits. The **[model-routing](commands/model-routing.md)** command reports the seats, pins any of them to a fixed model (a pin is honored verbatim), or frees them back to dynamic. Install the four agents and the command together; the switch needs the installer route, because plugin-scoped agents cannot take the built-in Explore and Plan names.

Unless you pin a seat, the resolution per session model:

| Session model | Explore | Plan | Execute | Review |
|---|---|---|---|---|
| Haiku | haiku | haiku | haiku | haiku |
| Sonnet | haiku | sonnet | sonnet | sonnet |
| Opus | haiku | opus | sonnet | opus |
| Your strongest tier | haiku | that tier | sonnet | that tier |

## Manual install

Prefer to copy by hand? A command is `commands/<name>.md` into `~/.claude/commands/`; a skill is the `skills/<name>/` folder into `~/.claude/skills/`; a hook is `hooks/<name>.mjs` into `~/.claude/hooks/` plus its settings block (event per `hooks/manifest.json`); an agent is `agents/<Name>.md` into `~/.claude/agents/`.

## Other ways to install

The npx installer above is the primary route, and the repo also works with two others:

- **Claude Code plugin**: run `/plugin marketplace add JayOfemi/claude-toolbox`, then `/plugin install toolbox@jayofemi`. Plugin installs namespace the entries, so the commands become `/toolbox:screenshot` and so on. The plugin also wires the two token hooks automatically (no settings edit; run `/reload-plugins` after a plugin update to pick up hook changes; if you previously wired those hooks through the installer, remove that settings block so they run once, not twice). The reply gate stays opt-in through the installer, and the model-routing agents need the installer route (plugin agents cannot take the built-in seat names; the plugin may list namespaced copies like `toolbox:Explore`, which the switch ignores since it manages only `~/.claude/agents/`). The same marketplace also lists two MCP server plugins, [shikamaru](https://github.com/JayOfemi/shikamaru) (finance math) and [ai-checker](https://github.com/JayOfemi/byakugan) (AI-text analysis), installable with `/plugin install shikamaru@jayofemi` and `/plugin install ai-checker@jayofemi`.
- **The skills CLI**: `npx skills add JayOfemi/claude-toolbox` installs the skills (not the commands) for Claude Code and other agents that read `SKILL.md` folders.

## Contributing

Small, self-contained, portable contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
