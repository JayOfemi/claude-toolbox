#!/usr/bin/env node
// Mechanical pass for the wording rules (em/en dash hard-fail; AI-tell and
// "copy" candidates advisory). Detect-only. Dash/quote literals are \u escapes.

import { readFileSync, statSync, readdirSync } from "node:fs";
import { join, extname, basename } from "node:path";
import { pathToFileURL } from "node:url";

export const RULES = [
	{
		id: "em-en-dash",
		severity: "fail",
		pattern: /[\u2013\u2014]/g,
		message: "em (U+2014) or en (U+2013) dash, banned everywhere",
	},
	{
		id: "dash-lookalike",
		severity: "review",
		pattern: /[\u2012\u2015\u2212]/g,
		message: "dash-like char (figure dash / horizontal bar / minus), likely a paste",
	},
	{
		id: "ai-tell-no-just",
		severity: "review",
		pattern: /\bno\s+\w[\w\s'\u2019-]{0,40}?[.,]\s*just\b/gi,
		message: "possible 'No X, just Y' punch, confirm it reads as rhetoric",
	},
	{
		id: "ai-tell-reversal",
		severity: "review",
		pattern: /\bit(?:['\u2019]s| is| was)\s+not\b[^.!?\n]{1,60}[.,]\s*it(?:['\u2019]s| is| was)\b/gi,
		message: "possible 'it is not X, it is Y' reversal, confirm it is drama not information",
	},
	{
		id: "ai-tell-reversal-bare",
		severity: "review",
		pattern: /\bnot\b[^.!?\n]{1,60},\s*it is\b/gi,
		message: "possible 'not X, it is Y' reversal, confirm it is drama not information",
	},
	{
		id: "ai-tell-you-get",
		severity: "review",
		pattern: /\byou get\b[^.!?\n]{1,60},\s*not\b/gi,
		message: "possible 'you get X, not Y' punch, confirm it reads as rhetoric",
	},
	{
		id: "ai-tell-dismissive-close",
		severity: "review",
		pattern: /\bthat(?:['\u2019]s| is)\s+the\s+whole\s+(?:product|pitch|point|idea|thing|story|deal)\b/gi,
		message: "dismissive close ('that's the whole ___'), reword",
	},
	{
		id: "copy-misuse",
		severity: "review",
		pattern: /\b(?:marketing|website|web|landing[\s-]?page|home[\s-]?page|hero|site|ad)\s+copy\b/gi,
		message: "'copy' used for site text, prefer 'wording' or 'site text'",
	},
	{
		// A colon swapped in where an em dash would go (an elaboration that should
		// just be a direct sentence). Advisory; legitimate in times, ratios, code.
		id: "colon-elaboration",
		severity: "review",
		pattern: /\b[a-z]+\s+[^.!?:\n]{0,50}[a-z]:\s+[a-z]/gi,
		message: "colon may be standing in for an em dash; if it just elaborates, restructure into a direct sentence (fine for times, ratios, code, labels)",
	},
];

const IGNORE_DIRS = new Set([
	"node_modules", ".git", "dist", "build", "out", "coverage", ".next", ".turbo", ".cache",
]);
const SKIP_EXT = new Set([
	".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".pdf", ".zip",
	".gz", ".tar", ".woff", ".woff2", ".ttf", ".otf", ".eot", ".mp3", ".mp4",
	".mov", ".webm", ".wasm", ".map", ".lockb",
]);
const SKIP_NAMES = new Set([
	"package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb",
]);

/** Scan a single string. Exposed for tests and ad-hoc checks. */
export function scanText(text, file = "(stdin)") {
	const findings = [];
	const seen = new Set();
	const lines = text.split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		for (const rule of RULES) {
			rule.pattern.lastIndex = 0;
			let m;
			while ((m = rule.pattern.exec(line)) !== null) {
				const key = `${i}:${m.index}:${rule.id}`;
				if (!seen.has(key)) {
					seen.add(key);
					findings.push({
						file,
						line: i + 1,
						col: m.index + 1,
						rule: rule.id,
						severity: rule.severity,
						match: m[0],
						context: line.trim().slice(0, 200),
						message: rule.message,
					});
				}
				if (m.index === rule.pattern.lastIndex) {
					rule.pattern.lastIndex++;
				}
			}
		}
	}
	return findings;
}

// A NUL byte in the first chunk is a reliable "this is binary" signal.
function looksBinary(text) {
	const limit = Math.min(text.length, 8000);
	for (let i = 0; i < limit; i++) {
		if (text.charCodeAt(i) === 0) {
			return true;
		}
	}
	return false;
}

function shouldSkip(file) {
	const name = basename(file);
	if (SKIP_NAMES.has(name) || name.endsWith(".min.js")) {
		return true;
	}
	return SKIP_EXT.has(extname(file).toLowerCase());
}

function collectFiles(target, acc) {
	const st = statSync(target);
	if (st.isDirectory()) {
		for (const entry of readdirSync(target, { withFileTypes: true })) {
			if (entry.isDirectory()) {
				if (!IGNORE_DIRS.has(entry.name)) {
					collectFiles(join(target, entry.name), acc);
				}
			} else if (entry.isFile() && !shouldSkip(entry.name)) {
				acc.push(join(target, entry.name));
			}
		}
	} else if (st.isFile() && !shouldSkip(target)) {
		acc.push(target);
	}
	return acc;
}

function render(findings, asJson) {
	if (asJson) {
		return JSON.stringify(findings, null, 2);
	}
	if (findings.length === 0) {
		return "wording: clean, no findings.";
	}
	const out = [];
	for (const f of findings) {
		out.push(`${f.file}:${f.line}:${f.col}  ${f.severity.toUpperCase()} ${f.rule}  ${f.message}`);
		out.push(`    ${f.context}`);
	}
	const fails = findings.filter((f) => f.severity === "fail").length;
	out.push("");
	out.push(`wording: ${fails} to fix, ${findings.length - fails} to review.`);
	return out.join("\n");
}

function usage() {
	process.stderr.write("usage: lint.mjs [--json] [--stdin] [files or dirs]\n");
	process.exit(2);
}

function main(argv) {
	const asJson = argv.includes("--json");
	const useStdin = argv.includes("--stdin");
	const targets = argv.filter((a) => !a.startsWith("--"));
	let findings = [];
	if (useStdin || targets.length === 0) {
		if (targets.length === 0 && !useStdin && process.stdin.isTTY) {
			usage();
		}
		let text = "";
		try {
			text = readFileSync(0, "utf8");
		} catch {
			text = "";
		}
		findings = scanText(text, "(stdin)");
	} else {
		const files = [];
		for (const t of targets) {
			collectFiles(t, files);
		}
		for (const file of files) {
			let text;
			try {
				text = readFileSync(file, "utf8");
			} catch {
				continue;
			}
			if (!looksBinary(text)) {
				findings.push(...scanText(text, file));
			}
		}
	}
	process.stdout.write(render(findings, asJson) + "\n");
	process.exit(findings.some((f) => f.severity === "fail") ? 1 : 0);
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
	main(process.argv.slice(2));
}
