---
name: gatekeeper
description: >-
  Scan a repository for secrets and private information before you make it public
  or publish it. Catches API keys, tokens, private keys, connection strings,
  local filesystem paths that leak a username, security-flavored TODOs, and
  configurable deny terms (your work email domain, internal codenames). Use it
  before flipping a repo public, before a first npm publish, and before every
  release of a public package. Trigger it whenever the task involves making code
  public or checking a repo for leaks.
---

# Gatekeeper scan

## Why this exists

Going public is one way: once a secret or a private name is in public git history, deleting it later does not unpublish it. This skill is the sweep you run before that step.

## Run the scan

`scripts/scan.mjs` is a zero-dependency Node scanner. It reads the repo's git-tracked files (or, outside a git repo, walks the directory) and reports findings by severity.

```
node scripts/scan.mjs /path/to/repo
```

Add `--json` for machine-readable output. The exit code is `1` if there is any blocking finding (critical or high), otherwise `0`.

## Configure project-specific terms

The universal patterns (keys, tokens, paths) are built in. For terms specific to you, add a `.publicrelease.json` at the repo root:

```json
{
  "allowedIdentities": ["my-repo", "your-public-handle"],
  "denyTerms": ["acme-internal", "corp-codename"]
}
```

- `denyTerms` are treated as critical leaks. Put your work email domain and your private project codenames here.
- `allowedIdentities` suppress findings that are meant to be public, like the repo's own name or a public contact.
- `ignoreGlobs` (optional) skip paths whose name contains the glob, for files that legitimately hold pattern-like text.

## Read the findings

- **critical** and **high** block: keys, private keys, credentialed connection strings, local paths, security TODOs, and configured deny terms. Fix these before publishing.
- **medium** and **info** are for review: phone numbers and generic emails. Confirm each is safe to ship.

## Fix and re-scan

Remove or move the secret, and rotate it if it was ever real, even after a history rewrite. Re-run until the scan reports no blocking findings. Then it is safe to make the repo public.

## Scope

This is the high-signal core: secret and private-info patterns, runnable anywhere Node is, with no dependencies. It does not replace a deep secret-history scanner like gitleaks or trufflehog, or a license and SBOM audit. For a package you are publishing to a registry, run those too.

## Disclaimer

This is a best-effort, pattern-based scanner, not a guarantee. A clean result means the built-in patterns and your configured deny terms matched nothing in the scanned files. It does not prove the repo is free of secrets or private information. New or obfuscated formats, and anything the patterns do not cover, will slip through. Treat a clean scan as one check among several: run a deeper secret-history scanner and review the diff yourself before you make a repo public. You are responsible for what you publish.
