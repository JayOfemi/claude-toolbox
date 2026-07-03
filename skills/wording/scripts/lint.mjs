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
		// A bound or qualifier tacked onto the end of a finished claim, the way a
		// person revises out loud mid-speech: "slow at best.", "a dozen, if
		// that.", "a handshake, if you will." Written prose
		// states the point once; the trailing walk-back is the tell. Anchored
		// clause-final so real conditionals ("if anything breaks, call me") and
		// front qualifiers ("At best, we ship Friday") do not match. A genuine
		// numeric bound ("2 seconds at most") can trip it; that is the review call.
		id: "ai-tell-trailing-hedge",
		severity: "review",
		pattern: /\b(?:at (?:the |very )?(?:most|best|worst)|if anything|if at all|if that|if you will|give or take|or so|more or less|such as it is|so to speak|as it were|for what(?:['\u2019]s| is) it worth|for whatever it(?:['\u2019]s| is) worth|whatever that means)(?=\s*["'\u2019)\]]*\s*(?:[.!?]|$))/gi,
		message: "trailing afterthought hedge ('... at most', '... if you will'); reads as thinking out loud, cut it or state the point plainly",
	},
	{
		id: "copy-misuse",
		severity: "review",
		pattern: /\b(?:marketing|website|web|landing[\s-]?page|home[\s-]?page|hero|site|ad)\s+copy\b/gi,
		message: "'copy' used for site text, prefer 'wording' or 'site text'",
	},
	{
		// Funding or tip-jar wording surfaced as site text. The business model is
		// the maker's concern, not the visitor's, so a line explaining how the
		// project is paid for reads as begging. Build intent like "free, a tip jar
		// at most" shapes what you build, not what the page says; a tip jar belongs
		// as a quiet optional button. Review, since the same words are fine as a
		// button label, or when taking money IS the job (a donation app).
		id: "surface-funding",
		severity: "review",
		pattern: /\b(?:tip jar|buy me a coffee|pay what you (?:want|can|like)|donations? (?:welcome|appreciated)|consider donating|please donate|chip in|ko-?fi|patreon|github sponsors|support (?:this (?:project|tool|app)|the project|my work))\b/gi,
		message: "funding or tip-jar wording in descriptive text; keep the funding model off the surface (a quiet button is fine), say what the visitor gets",
	},
	{
		// Implementation jargon ("heavy lifting", "on-device") or vague hype
		// ("seamless", "blazing") dropped onto a user surface; it means little to a
		// visitor and reads as internal shorthand. Review, since it is fine in dev
		// docs or a deliberately technical section.
		id: "surface-jargon",
		severity: "review",
		pattern: /\b(?:heavyweight|lightweight|heavy lifting|on-device|under the hood|out of the box|host model|local model|zero-config|client-side|server-side|seamless(?:ly)?|effortless(?:ly)?|blazing(?:ly)?|supercharged?|cutting-edge|state-of-the-art|next-gen(?:eration)?)\b/gi,
		message: "implementation jargon or hype on a user-facing surface; say what the visitor gets in plain words (fine in dev docs or a deliberately technical section)",
	},
	{
		// A sentence that announces the shape of the answer or restates the topic
		// instead of delivering it: "I've worked with X from both sides.", "I have
		// also worked the server side.", "let me break this down", "at a high
		// level". Lead with the substance. A clause opener like "On the server
		// side," is fine; the standalone announcer is the tell.
		id: "ai-tell-announce",
		severity: "review",
		pattern: /\b(?:(?:from|on)\s+both\s+(?:sides|fronts)|I(?:['’]ve| have)\s+(?:also\s+)?worked\s+(?:with\s+[\w-]+\s+)?(?:on|the)\s+[\w\s-]{0,15}?\bsides?\b|let\s+me\s+break\s+(?:this|it|that)\s+down|at\s+a\s+high\s+level|to\s+answer\s+(?:your|the)\s+question)\b/gi,
		message: "topic-announcing / throat-clearing framing ('from both sides', 'I have also worked the X side', 'let me break this down'); lead with the substance, not the structure",
	},
	{
		// A vague connective bolted onto the next clause as filler: "Around that",
		// "On top of that", "That said", "At the end of the day". Cut it and state
		// the point. Anchored sentence-initial so a literal mid-clause use ("built
		// around that constraint") does not match.
		id: "ai-tell-glue",
		severity: "review",
		pattern: /(?:^|[.!?]\s+)(?:Around that|On top of that|Beyond that|With that said|That said|All in all|All told|Needless to say|Suffice (?:it )?to say|At the end of the day|When all is said and done)\b/g,
		message: "gluey filler transition ('Around that', 'On top of that', 'That said'); cut it and state the next point directly",
	},
	{
		// Stacked relative clauses padding a noun: "Claude Code, the command-line
		// tool, which I have used daily and which is my primary client". Keep the
		// one essential detail or split the sentence.
		id: "ai-tell-over-qualify",
		severity: "review",
		pattern: /\bwhich\s+[^,.;:!?\n]{5,80}?\s+and\s+which\b/gi,
		message: "stacked 'which ... and which' clauses over-qualify the noun; keep the essential detail or split the sentence",
	},
	{
		// A colon swapped in where an em dash would go (an elaboration that should
		// just be a direct sentence). Advisory; legitimate in times, ratios, code,
		// a genuine label, or a list introduced by a word like "include" / "as
		// follows" (those introducers are carved out below to cut false positives).
		id: "colon-elaboration",
		severity: "review",
		pattern: /\b[a-z]+\s+[^.!?:\n]{0,50}?\b(?!(?:include|includes|including|included|follow|follows|following|namely|below)\b)[a-z]{2,}:\s+[a-z]/gi,
		message: "colon may be standing in for an em dash; if it just elaborates, restructure into a direct sentence (fine for times, ratios, code, labels, and 'include'-style lists)",
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
