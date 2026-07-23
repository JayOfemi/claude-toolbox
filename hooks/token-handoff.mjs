#!/usr/bin/env node
// UserPromptSubmit token handoff: surfaces the PREVIOUS turn's cost inside the
// next reply, for hosts that do not render Stop-hook systemMessage output
// (some app surfaces; plain terminal sessions render it and need no handoff).
// Reads the per-session handoff file that token-report.mjs writes at stop,
// injects one instruction line via stdout at exit 0, and consumes the message
// so a zero-cost turn never re-injects a stale count (the cumulative field
// stays behind for the reporter). Routes and reports only - never blocks;
// infra errors degrade to silent pass, same as its siblings (a broken
// reporter must not tax or block prompts).
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

function fmt(n) {
	return Number(n || 0).toLocaleString("en-US");
}

try {
	let raw = readFileSync(0, "utf8");
	if (raw.charCodeAt(0) === 0xfeff) {
		raw = raw.slice(1);
	}
	const payload = JSON.parse(raw) ?? {};
	const sessionId = String(payload.session_id ?? "").replace(/[^\w-]/g, "");
	if (!sessionId) {
		process.exit(0);
	}
	const file = join(tmpdir(), `token-report-${sessionId}.json`);
	const state = JSON.parse(readFileSync(file, "utf8"));
	if (!state || typeof state.total !== "number") {
		process.exit(0);
	}
	const line = `Tokens last turn: ${fmt(state.total)} (session ~${fmt(state.cum ?? state.total)})`;
	delete state.total;
	writeFileSync(file, JSON.stringify(state));
	process.stdout.write(
		`Token handoff: the previous turn's cost is below. End your current reply with this single line, verbatim, after everything else:\n${line}\n`
	);
} catch {}
process.exit(0);
