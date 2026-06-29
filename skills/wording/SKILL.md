---
name: wording
description: >-
  Lint user-visible text before it ships, catching em and en dashes, a colon
  used in place of an em dash, AI-tell phrasing, the word "copy" misused for
  site text, and jargon or surfaced internal concerns like funding on
  non-technical surfaces.
---

# Wording lint

## Why this exists

One em or en dash, or one AI-tell construction, makes writing read as machine-generated. This skill is the detect-and-fix pass that keeps them out of anything a reader sees.

## The rules

1. **No em (U+2014) or en (U+2013) dash, anywhere.** Use a hyphen, comma, period, semicolon, parens, or a rewrite.
2. **No colon standing in for an em dash.** A colon that just introduces an elaboration or list should be restructured into a direct sentence, even if slightly less formal. For example, "production software: web apps, mobile apps, and automations" becomes "production software including web apps, mobile apps, and automations". Still fine in clock times, ratios, code, and genuine labels.
3. **No AI-tell constructions:**
   - the "No X, just Y" punch ("No run arounds, just results"),
   - the "it is not X, it is Y" dramatic reversal,
   - the dismissive close ("that's the whole product / pitch / point"),
   - the trailing "thinking out loud" hedge, a bound or qualifier tacked onto the end of a finished claim ("a dozen, if that", "a handshake, if you will"). State the point once instead.
   Flat, informational contrast is fine: "fixed prices, not open ended hourly" tells the reader the pricing model. The same shape used as rhetoric is not.
4. **Do not use "copy" to mean site text.** Prefer "wording" or "site text". ("Copy the file" is fine; "refresh the marketing copy" is the misuse.)
5. **No jargon, and no surfaced internal concerns, on a non-technical surface.** Say what the thing does, not how it is built or funded. Funding is the clearest case: a line about how the project is paid for (a tip jar, "buy me a coffee", donations) reads as begging. Keep it off the surface; let a tip jar be a quiet optional button, never a sentence in the product description.

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
- `REVIEW` is a candidate the detector cannot judge alone: an AI-tell pattern, a colon that may be standing in for an em dash, a dash-like lookalike, a "copy" usage, a funding or tip-jar phrase, or implementation jargon. You decide.

The detector is deliberately generous on `REVIEW` candidates, because a missed AI-tell costs more than a candidate you glance at and dismiss.

### 3. Adjudicate

For the contrast patterns, the test is whether the contrast carries information or is just drama (rule 3). For the colon (rule 2), restructure when it just introduces an elaboration or list, and leave it for clock times, ratios, code, or a genuine label. For "copy", confirm it means site text. The surface-jargon rule flags common offenders, but it cannot catch every phrasing, so judge plain language yourself on anything public-facing; a clean detector run is not proof the wording is intuitive.

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
