# Toolbox

Small, portable tools for Claude Code: skills, commands, and scripts pulled from real daily use, packaged so you can install one in seconds and own it.

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

Two kinds of entry, split by who invokes them:

- **Commands** are slash commands you invoke by name, like `/screenshot`. They install to `~/.claude/commands/`.
- **Skills** are ones Claude reaches for on its own when a task matches their description, and you can invoke them by name too. They install to `~/.claude/skills/`.

### Commands

- **[screenshot](commands/screenshot.md)**: save a slice of the conversation. A good exchange is easy to lose once a session moves on or compacts, so `/screenshot` writes the last N prompt-and-reply pairs, with the model that produced them, to a timestamped file in `captures/`. The useful parts are kept verbatim.

### Skills

None yet. The library is young and grows as tools earn their place in daily use.

## Manual install

Prefer to copy by hand? A command is `commands/<name>.md` into `~/.claude/commands/`; a skill is the `skills/<name>/` folder into `~/.claude/skills/`.

## Contributing

Small, self-contained, portable contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
