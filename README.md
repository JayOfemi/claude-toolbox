# Toolbox

An open library of reusable Claude Code skills, commands, and scripts.

Each entry is self-contained and installs by copying it into your Claude Code config.

- Skills live in `skills/<name>/` and install to `~/.claude/skills/<name>/`. A skill is one Claude invokes on its own when a task matches its description.
- Commands live in `commands/<name>.md` and install to `~/.claude/commands/<name>.md`. A command is a slash command you invoke by name, like `/screenshot`.
- Scripts a skill or command needs ship inside that entry's folder.

## Install a command

macOS / Linux:

```
mkdir -p ~/.claude/commands && cp commands/screenshot.md ~/.claude/commands/
```

Windows (PowerShell):

```
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.claude\commands" | Out-Null
Copy-Item commands\screenshot.md "$env:USERPROFILE\.claude\commands\screenshot.md" -Force
```

## Install a skill

macOS / Linux:

```
cp -r skills/<name> ~/.claude/skills/
```

Windows (PowerShell):

```
Copy-Item -Recurse skills\<name> "$env:USERPROFILE\.claude\skills\" -Force
```

## Contents

Commands:

- `screenshot` - save the last N prompt-reply exchanges, with the model that produced them, to a timestamped file in `captures/`.

Skills:

- none yet.

## License

MIT. See [LICENSE](LICENSE).
