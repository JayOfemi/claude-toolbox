# Toolbox

An open library of reusable Claude Code skills, commands, and scripts.

- Skills live in `skills/<name>/` and install to `~/.claude/skills/<name>/`. A skill is one Claude invokes on its own when a task matches its description.
- Commands live in `commands/<name>.md` and install to `~/.claude/commands/<name>.md`. A command is a slash command you invoke by name, like `/screenshot`.
- Scripts a skill or command needs ship inside that entry's folder.

## Quickstart

Install with the bundled installer; it copies the ones you pick into `~/.claude/`:

```
npx @jayofemi/toolbox
```

Install specific entries without the prompt:

```
npx @jayofemi/toolbox add screenshot
```

`npx @jayofemi/toolbox list` shows everything available. Skills land in `~/.claude/skills/<name>/`, commands in `~/.claude/commands/<name>.md`.

### Manual install

Copy any entry yourself: a command is `commands/<name>.md` copied into `~/.claude/commands/`; a skill is the `skills/<name>/` folder copied into `~/.claude/skills/`.

## Contents

Commands:

- `screenshot` - save the last N prompt-reply exchanges, with the model that produced them, to a timestamped file in `captures/`.

Skills:

- none yet.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).
