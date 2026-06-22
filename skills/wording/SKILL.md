---
name: wording
description: >-
  Lint user-visible text against a set of wording rules before it ships: em and
  en dashes (banned outright), AI-tell constructions (the "No X, just Y" punch,
  the "it is not X, it is Y" reversal, dismissive "that's the whole product"
  closes), the word "copy" used to mean site text, and jargon on non-technical
  surfaces. Use it whenever you draft or review any text a reader will see: UI
  strings, marketing or site wording, READMEs, store listings, emails, error
  messages, and commit messages. Trigger it even when the request does not say
  "lint" or "wording", as long as the task produces or polishes text that ships.
---

# Wording lint

## Why this exists

One em or en dash, or one AI-tell construction, makes writing read as machine-generated. This skill is the detect-and-fix pass that keeps them out of anything a reader sees.

## The rules

1. **No em (U+2014) or en (U+2013) dash, anywhere.** Use a hyphen, comma, period, semicolon, parens, or a rewrite.
2. **No AI-tell constructions:**
   - the "No X, just Y" punch ("No run arounds, just results"),
   - the "it is not X, it is Y" dramatic reversal,
   - the dismissive close ("that's the whole product / pitch / point").
   Flat, informational contrast is fine: "fixed prices, not open ended hourly" tells the reader the pricing model. The same shape used as rhetoric is not.
3. **Do not use "copy" to mean site text.** Prefer "wording" or "site text". ("Copy the file" is fine; "refresh the marketing copy" is the misuse.)
4. **No jargon on a non-technical surface.** On anything a general audience reads, say what the thing does, not how it is built.

## Procedure

### 1. Run the detector

`scripts/lint.mjs` does the mechanical pass. Zero dependencies, no build step.

Lint files or a folder:

```
node scripts/lint.mjs path/to/file.md path/to/dir
```

Lint a draft from stdin:

```
printf '%s' "your draft text" | node scripts/lint.mjs --stdin
```

Add `--json` for machine-readable findings.

### 2. Read the findings

- `FAIL` is an em or en dash. Always wrong; fix it.
- `REVIEW` is a candidate the detector cannot judge alone: an AI-tell pattern, a dash-like lookalike, or a "copy" usage. You decide.

The detector is deliberately generous on `REVIEW` candidates, because a missed AI-tell costs more than a candidate you glance at and dismiss.

### 3. Adjudicate

For the contrast patterns, the test is whether the contrast carries information or is just drama (rule 2). For "copy", confirm it means site text. The detector cannot see jargon; judge that yourself on anything public-facing.

### 4. Fix

Choose the replacement that fits the sentence: a dash is not always a hyphen, it may want a comma, a period, parens, or a rewrite. Keep the file UTF-8 without a BOM.

## Report format

```
Wording check: <target>
- FAIL   <file>:<line>  <rule>  "<snippet>"  =>  <fix>
- REVIEW <file>:<line>  <rule>  "<snippet>"  =>  <your call + fix>
Result: <N> fixed, <M> reviewed, <K> left as written (with reason)
```

If everything is clean, say so.

## Exit codes

The detector exits `0` when there are no `FAIL` findings, `1` when there is at least one, and `2` on a usage error. A pre-commit hook or CI step can call it on changed files and gate on exit `1`.
