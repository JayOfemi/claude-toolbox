#!/usr/bin/env node
// Stop-hook token reporter: sums the turn's full token cost (main session plus
// sync, background, and workflow subagents) into one systemMessage line.
// Reporter, never a gate: always exits 0, silent on any internal error and on
// a zero-cost turn. Also drops the numbers to a per-session tmp handoff file
// (token-handoff.mjs surfaces them next turn on hosts that render no
// systemMessage) and appends a daily JSONL ledger line under
// ~/.claude/token-ledger/. A blocked stop re-runs Stop hooks
// (stop_hook_active), so a re-run of the SAME turn replaces its own prior
// handoff count instead of adding to it; ledger lines carry the turn-start
// timestamp, so consumers dedupe per (session, turn), last write wins.
// TOKEN_REPORT_NOW (ISO) freezes "now" for fixtures;
// TOKEN_REPORT_DEBUG=1 prints a per-source breakdown to stderr.
import { appendFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

const GRACE_MS = 60000;
const DEBUG = process.env.TOKEN_REPORT_DEBUG === "1";

function parseLines(text) {
	const entries = [];
	for (const line of text.split("\n")) {
		if (!line.trim()) {
			continue;
		}
		try {
			const parsed = JSON.parse(line);
			if (parsed !== null && typeof parsed === "object") {
				entries.push(parsed);
			}
		} catch {
			// The transcript is appended while we run; tolerate a truncated line.
		}
	}
	return entries;
}

function textHead(content) {
	if (typeof content === "string") {
		return content;
	}
	if (Array.isArray(content)) {
		for (const block of content) {
			if (block && block.type === "text" && typeof block.text === "string") {
				return block.text;
			}
		}
	}
	return "";
}

// Turn start = last real user entry: not a tool_result carrier, not meta,
// not local-command echo, not an interrupt marker.
function isTurnStart(entry) {
	if (entry.type !== "user" || entry.isMeta === true) {
		return false;
	}
	if (entry.isCompactSummary === true) {
		return false;
	}
	const content = entry.message && entry.message.content;
	if (Array.isArray(content) && content.some((b) => b && b.type === "tool_result")) {
		return false;
	}
	const head = textHead(content);
	if (head.startsWith("<local-command-stdout>") || head.startsWith("<local-command-caveat>")) {
		return false;
	}
	return !head.startsWith("[Request interrupted by user");
}

// One API response spans many JSONL lines (one per content block); dedupe per
// message.id and keep the last snapshot, which carries the final output count.
function collectUsage(map, entry) {
	if (entry.type !== "assistant") {
		return;
	}
	const msg = entry.message;
	if (!msg || !msg.usage || msg.model === "<synthetic>") {
		return;
	}
	const key = msg.id || entry.requestId || entry.uuid;
	if (!key) {
		return;
	}
	map.set(key, { usage: msg.usage, ts: Date.parse(entry.timestamp) });
}

function sumUsage(map, startMs, endMs) {
	const t = { input: 0, output: 0, cacheRead: 0, cacheCreate: 0, calls: 0 };
	for (const { usage, ts } of map.values()) {
		if (startMs !== null && !Number.isNaN(ts) && (ts < startMs || ts > endMs)) {
			continue;
		}
		t.input += usage.input_tokens || 0;
		t.output += usage.output_tokens || 0;
		t.cacheRead += usage.cache_read_input_tokens || 0;
		t.cacheCreate += usage.cache_creation_input_tokens || 0;
		t.calls += 1;
	}
	return t;
}

// Only agent transcripts carry usage; meta.json, journal.jsonl, and .output
// files never match this pattern, so echoes of the same cost are never reread.
function agentFiles(dir) {
	try {
		return readdirSync(dir)
			.filter((f) => /^agent-[0-9a-f]+\.jsonl$/.test(f))
			.map((f) => join(dir, f));
	} catch {
		return [];
	}
}

function fmt(n) {
	return n.toLocaleString("en-US");
}

function debugLine(label, t) {
	console.error(`[token-report] ${label}: ${t.calls} calls, in ${t.input}, out ${t.output}, cache_read ${t.cacheRead}, cache_create ${t.cacheCreate}`);
}

function run() {
	let stdin = readFileSync(0, "utf8");
	if (stdin.charCodeAt(0) === 0xfeff) {
		stdin = stdin.slice(1);
	}
	const hook = JSON.parse(stdin);
	const transcriptPath = String(hook.transcript_path || "");
	if (!transcriptPath) {
		return;
	}
	const entries = parseLines(readFileSync(transcriptPath, "utf8"));
	let startIdx = -1;
	for (let i = entries.length - 1; i >= 0; i--) {
		if (isTurnStart(entries[i])) {
			startIdx = i;
			break;
		}
	}
	if (startIdx < 0) {
		return;
	}
	const startMs = Date.parse(entries[startIdx].timestamp);
	if (Number.isNaN(startMs)) {
		return;
	}
	let nowMs = process.env.TOKEN_REPORT_NOW ? Date.parse(process.env.TOKEN_REPORT_NOW) : Date.now();
	if (Number.isNaN(nowMs)) {
		nowMs = Date.now();
	}
	const endMs = nowMs + GRACE_MS;

	// Main transcript: positional scope, turn start to EOF. Skip inline
	// sidechain entries so older builds that embed them never double count.
	const mainMap = new Map();
	for (let i = startIdx; i < entries.length; i++) {
		if (entries[i].isSidechain === true) {
			continue;
		}
		collectUsage(mainMap, entries[i]);
	}
	const main = sumUsage(mainMap, null, endMs);
	if (DEBUG) {
		console.error(`[token-report] turn start ${entries[startIdx].timestamp} (entry ${startIdx + 1} of ${entries.length})`);
		debugLine("main", main);
	}

	const sessionDir = transcriptPath.endsWith(".jsonl")
		? transcriptPath.slice(0, -6)
		: join(dirname(transcriptPath), String(hook.session_id || ""));
	const subDir = join(sessionDir, "subagents");
	const candidates = agentFiles(subDir);
	const wfRoot = join(subDir, "workflows");
	try {
		for (const name of readdirSync(wfRoot)) {
			if (name.startsWith("wf_")) {
				candidates.push(...agentFiles(join(wfRoot, name)));
			}
		}
	} catch {
		// No workflow runs in this session.
	}

	const sub = { input: 0, output: 0, cacheRead: 0, cacheCreate: 0, calls: 0 };
	let subCount = 0;
	for (const file of candidates) {
		let stat;
		try {
			stat = statSync(file);
		} catch {
			continue;
		}
		if (stat.mtimeMs < startMs - GRACE_MS) {
			continue;
		}
		let text;
		try {
			text = readFileSync(file, "utf8");
		} catch {
			continue;
		}
		const map = new Map();
		for (const entry of parseLines(text)) {
			collectUsage(map, entry);
		}
		const t = sumUsage(map, startMs, endMs);
		if (t.input + t.output + t.cacheRead + t.cacheCreate <= 0) {
			continue;
		}
		subCount += 1;
		sub.input += t.input;
		sub.output += t.output;
		sub.cacheRead += t.cacheRead;
		sub.cacheCreate += t.cacheCreate;
		sub.calls += t.calls;
		if (DEBUG) {
			debugLine(basename(file), t);
		}
	}

	const out = main.output + sub.output;
	const inp = main.input + sub.input;
	const cache = main.cacheRead + main.cacheCreate + sub.cacheRead + sub.cacheCreate;
	const total = out + inp + cache;
	if (total <= 0) {
		return;
	}
	let message = `Tokens this turn: ${fmt(total)} total (out ${fmt(out)}, in ${fmt(inp)}, cache ${fmt(cache)})`;
	if (subCount > 0) {
		const subTotal = sub.input + sub.output + sub.cacheRead + sub.cacheCreate;
		message += `, incl. ${subCount} subagent${subCount === 1 ? "" : "s"}: ${fmt(subTotal)}`;
	}
	process.stdout.write(JSON.stringify({ systemMessage: message }) + "\n");

	const sessionId = String(hook.session_id ?? "unknown").replace(/[^\w-]/g, "");
	const turnIso = String(entries[startIdx].timestamp ?? "");
	try {
		// Handoff for the next-turn surfacing hook; cum survives the consume.
		const handoffPath = join(tmpdir(), `token-report-${sessionId}.json`);
		let cum = 0;
		let prev = null;
		try {
			prev = JSON.parse(readFileSync(handoffPath, "utf8"));
			cum = Number(prev.cum) || 0;
		} catch {}
		if (hook.stop_hook_active === true && prev && typeof prev.total === "number" && prev.turn === turnIso) {
			cum -= prev.total;
		}
		writeFileSync(handoffPath, JSON.stringify({ total, cum: cum + total, subCount, ts: nowMs, turn: turnIso }));
	} catch {}
	try {
		const dir = join(homedir(), ".claude", "token-ledger");
		mkdirSync(dir, { recursive: true });
		const iso = new Date(nowMs).toISOString();
		appendFileSync(
			join(dir, `${iso.slice(0, 10)}.jsonl`),
			JSON.stringify({ ts: iso, turn: turnIso, session: sessionId, total, out, in: inp, cache, subagents: subCount }) + "\n"
		);
	} catch {}
}

try {
	run();
} catch (err) {
	if (DEBUG) {
		console.error(`[token-report] error: ${err && err.message}`);
	}
}
process.exit(0);
