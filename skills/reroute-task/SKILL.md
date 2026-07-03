---
name: reroute-task
description: >-
  Run a task on a chosen model (haiku, sonnet, opus, or fable) by delegating to a
  subagent, so the main session keeps its model and only the delegated work runs
  on the chosen one. Invoke as /reroute-task <model> [task].
---

# Reroute a task to a chosen model

Run a task on a specific model by delegating to a subagent. The main session's model does not change; only the delegated work runs on the chosen model.

## The model

The user names the target model when they invoke this, as `/reroute-task <model> [task]`, where `<model>` is one of `haiku`, `sonnet`, `opus`, or `fable`. A future estimator could choose the model instead of the user; the delegation below is the same either way.

## Procedure

Read the invoking message. The first word after the skill name is the target model, and anything after it is the task.

1. If the first word is not one of the four models, list the valid options and stop.
2. If a task follows the model name, delegate it now. Use the Task tool with `model` set to that model. The subagent does not see this conversation, so pass it the goal, the files, and the constraints it needs, plus the tools the task calls for. Report what it did and its result. This turn is the one acted on, and the next turn is back to normal.
3. If only a model name was given, reply with "What task should I run on <model>?" and wait. Treat the next message as the task and delegate it the same way.

## Notes

- The saving comes from the subagent doing the volume of work on the cheaper model; the main session still reads the request and sets up the delegation.
- For a long task you do not need to watch, delegate it in the background so you are notified when it finishes.
