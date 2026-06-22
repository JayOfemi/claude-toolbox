---
description: Capture the last N prompt-reply exchanges verbatim, with the model that produced them, to a timestamped file in captures/
argument-hint: [pairs]
allowed-tools: Bash(date:*)
---
Timestamp: !`date +%Y-%m-%d_%H%M%S`

Save a text "screenshot" of the conversation.

Capture the most recent prompt-and-reply exchanges, verbatim. `$ARGUMENTS` is the number of exchange pairs to capture, counting back from the most recent; each pair is one user prompt and your reply to it. If `$ARGUMENTS` is empty, capture the single most recent pair (the user's last prompt and your last reply). Exclude this `/screenshot` invocation itself.

Write the captured text exactly as written, with no summarizing or editing, to `captures/<timestamp>.md` in the current working directory, using the timestamp above for `<timestamp>`. Create the `captures/` folder if it does not exist. Start the file with a short header holding the timestamp and the model you are running as (its name and exact id, from your system context), then the exchanges in order, each marked with which part is the prompt and which is the reply.

Then report the path written and how many pairs were captured.

Fidelity note: this reproduces text from the live conversation context. It is exact for recent turns; any exchange older than a context compaction is the summarized form, not verbatim.
