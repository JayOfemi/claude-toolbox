---
description: Ask a chosen model a question by delegating to a subagent on that model, leaving this session's model unchanged
argument-hint: <model> [question]
allowed-tools: Task
---

Route a question to a chosen model without changing this session's model.

`$ARGUMENTS` starts with the target model, one of `haiku`, `sonnet`, `opus`, or `fable`. Anything after it is the question.

1. If the first word is not one of those four models, list the valid options and stop.
2. If a question follows the model name, ask it now. Use the Task tool with `model` set to that model, pass the question through verbatim, and give the subagent read-only tools (Read, Grep, Glob) so it can answer questions about this repo without changing anything. Return its answer, labeled with the model that produced it. This turn is the one acted on, and the next turn is back to normal.
3. If only a model name was given, reply with "What would you like to ask <model>?" and wait. Treat the next message as the question and delegate it the same way.

Lead with the model's answer, not your own commentary.
