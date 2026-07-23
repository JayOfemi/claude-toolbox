#!/usr/bin/env node
// Stop-hook reply gate: mechanically checks the turn's final reply against a
// prose-length ceiling (fenced and inline code stripped first). On a violation
// it blocks the stop ONCE (exit 2) with exact findings so the model runs a
// compression pass; the stop_hook_active flag means the revised reply always
// passes, so a loop is impossible. Judgment about what a good reply says stays
// with the model and you; this gate only holds the length. Infra errors
// degrade to silent pass (a broken detector must not trap every session at
// stop). REPLY_GATE_MAX_WORDS (positive number; Infinity disables) overrides
// the ceiling; REPLY_GATE_DEBUG=1 prints stats to stderr.
import { readFileSync } from "node:fs";

const MAX_WORDS = Number(process.env.REPLY_GATE_MAX_WORDS) || 300;
const DEBUG = process.env.REPLY_GATE_DEBUG === "1";

let input = "";
try {
	input = readFileSync(0, "utf8");
} catch {
	process.exit(0);
}
if (input.charCodeAt(0) === 0xfeff) {
	input = input.slice(1);
}

let payload = {};
try {
	payload = JSON.parse(input) ?? {};
} catch {
	process.exit(0);
}
if (payload.stop_hook_active) {
	process.exit(0);
}

let lines = [];
try {
	lines = readFileSync(String(payload.transcript_path ?? ""), "utf8").split("\n");
} catch {
	process.exit(0);
}

// The final reply = every text block of the newest text-bearing assistant
// message (one API message can span multiple JSONL lines, one per block).
let reply = "";
let replyId = null;
for (let i = lines.length - 1; i >= 0; i--) {
	const line = lines[i].trim();
	if (!line) {
		continue;
	}
	let entry;
	try {
		entry = JSON.parse(line);
	} catch {
		continue;
	}
	// Turn boundary (user prompt or tool result): a turn that ends with no
	// text reply passes quietly instead of re-judging an older, sent reply.
	if (entry?.type === "user" && !entry?.isSidechain) {
		break;
	}
	if (entry?.type !== "assistant" || entry?.isSidechain) {
		continue;
	}
	const content = entry?.message?.content;
	if (!Array.isArray(content)) {
		continue;
	}
	const text = content
		.filter((c) => c?.type === "text" && typeof c.text === "string")
		.map((c) => c.text)
		.join("\n")
		.trim();
	if (!text) {
		continue;
	}
	const id = entry?.message?.id ?? null;
	if (replyId === null) {
		replyId = id;
		reply = text;
		continue;
	}
	if (id !== null && id === replyId) {
		reply = `${text}\n${reply}`;
		continue;
	}
	break;
}
if (!reply) {
	process.exit(0);
}

const prose = reply.replace(/```[\s\S]*?(?:```|$)/g, " ").replace(/`[^`\n]*`/g, " ");
const words = prose.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;

const findings = [];
if (words > MAX_WORDS) {
	findings.push(`${words} words of prose (ceiling ${MAX_WORDS}). Run a compression pass.`);
}
if (DEBUG) {
	process.stderr.write(`reply-gate debug: ${words} words\n`);
}
if (findings.length === 0) {
	process.exit(0);
}
process.stderr.write(
	`Reply gate on the final reply:\n- ${findings.join("\n- ")}\nThe blocked reply is ALREADY on the user's screen; never resend it in full (that renders as a duplicate). Send only a compressed TLDR of it. If the length was genuinely required (depth the reader asked for), say so in one line and stop; this gate does not fire twice on one turn.\n`
);
process.exit(2);
