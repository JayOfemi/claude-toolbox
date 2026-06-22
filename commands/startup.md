---
description: Session opener that stamps today's date so the agent stops guessing it, then reads this project's context files and confirms ready. Run it at the start of a working session.
allowed-tools: Bash(date:*)
---
Today is !`date +%Y-%m-%d`. Treat this as the authoritative current date for this session. Do not infer it from file contents, git history, or memory.

Perform startup for the project in the current working directory.

Read in full, not skim: the project's agent context file in the working directory (`CLAUDE.md` or `AGENTS.md`, whichever exists), and every file it points to, to the end of the chain.

Then skim, if the project keeps them: the most recent entries of any changelog or session notes, and the `README.md`.

If a referenced file is missing, say so. When done, confirm read and ready with a one-line summary of where the project stands.
