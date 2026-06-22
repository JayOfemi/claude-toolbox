#!/usr/bin/env node
// gatekeeper scan: a zero-dependency pre-public sweep for secrets and private
// info. Reads a repo's git-tracked files (or walks a directory) and reports
// findings by severity. Universal patterns are built in; add your own work-email
// domain or private codenames as denyTerms in .publicrelease.json.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const RULES = [
	{ id: "aws-access-key-id", severity: "critical", description: "AWS access key ID", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
	{ id: "github-token", severity: "critical", description: "GitHub token", pattern: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{36}\b|\bgithub_pat_[A-Za-z0-9_]{22,}\b/ },
	{ id: "slack-token", severity: "critical", description: "Slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
	{ id: "slack-webhook", severity: "critical", description: "Slack webhook URL", pattern: /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9_/]+/ },
	{ id: "google-api-key", severity: "critical", description: "Google API key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/ },
	{ id: "private-key-block", severity: "critical", description: "Private key block", pattern: /-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/ },
	{ id: "jwt", severity: "high", description: "JSON Web Token", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/ },
	{ id: "connection-string-with-credentials", severity: "critical", description: "Connection string with inline credentials", pattern: /\b(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis|amqps?):\/\/[^\s:@/]+:[^\s:@/]+@/i },
	{ id: "azure-storage-account-key", severity: "critical", description: "Azure storage account key", pattern: /AccountKey=[A-Za-z0-9+/]{43,}={0,2}/ },
	{
		id: "generic-secret-assignment",
		severity: "high",
		description: "Hardcoded secret assignment",
		pattern: /(?:password|passwd|pwd|secret|api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret)\s*[:=]\s*['"][^'"]{6,}['"]/i,
		falsePositiveHints: ["process.env", "import.meta.env", "${", "<", "your-", "example", "changeme", "placeholder", "xxxx", "redacted", "dummy", "test"],
	},
	{ id: "generic-email", severity: "info", description: "Email address (review; allowlist the intended public one)", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/ },
	{ id: "phone-number", severity: "medium", description: "Possible phone number", pattern: /\b\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/ },
	{ id: "security-todo", severity: "high", description: "Security-flavored TODO or FIXME", pattern: /\b(?:TODO|FIXME|HACK|XXX)\b[^\n]{0,40}(?:secur|auth|token|password|vuln|inject)/i },
	{ id: "local-filesystem-path", severity: "high", description: "Local filesystem path (leaks a username and machine layout)", pattern: /[A-Za-z]:\\Users\\(?!Public\b|Default\b)[^\s\\/"'<>|]+|\/(?:home|Users)\/(?!runner\b|root\b|ubuntu\b|node\b|vscode\b|administrator\b)[A-Za-z0-9._-]+/i },
];

const SEVERITY_ORDER = ["critical", "high", "medium", "info"];
const BLOCKING = new Set(["critical", "high"]);
const IGNORE_DIRS = new Set(["node_modules", ".git", "dist", "build", "out", "coverage", ".next"]);
const SKIP_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".gz", ".woff", ".woff2", ".ttf", ".otf", ".eot", ".mp3", ".mp4", ".mov", ".wasm", ".map"]);

function escapeRe(s) {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function loadConfig(root) {
	const path = join(root, ".publicrelease.json");
	if (existsSync(path)) {
		try {
			const c = JSON.parse(readFileSync(path, "utf8"));
			return {
				allowedIdentities: c.allowedIdentities ?? [],
				denyTerms: c.denyTerms ?? [],
				ignoreGlobs: c.ignoreGlobs ?? [],
			};
		} catch {
			// fall through to defaults
		}
	}
	return { allowedIdentities: [], denyTerms: [], ignoreGlobs: [] };
}

export function buildRules(config) {
	const deny = (config.denyTerms ?? []).map((term, i) => ({
		id: `deny-term-${i}`,
		severity: "critical",
		description: `Configured deny term "${term}"`,
		pattern: new RegExp(escapeRe(term), "i"),
	}));
	return [...RULES, ...deny].map((rule) => ({
		rule,
		re: rule.pattern.flags.includes("g") ? rule.pattern : new RegExp(rule.pattern.source, `${rule.pattern.flags}g`),
	}));
}

function allowlisted(text, allow) {
	const t = text.toLowerCase();
	return allow.some((a) => {
		const x = a.toLowerCase();
		return x.includes(t) || t.includes(x);
	});
}

function looksBinary(text) {
	const limit = Math.min(text.length, 8000);
	for (let i = 0; i < limit; i++) {
		if (text.charCodeAt(i) === 0) {
			return true;
		}
	}
	return false;
}

/** Scan a single string against compiled rules. Exposed for tests. */
export function scanText(content, file, compiled, allow = []) {
	if (looksBinary(content)) {
		return [];
	}
	const findings = [];
	const lines = content.split(/\r?\n/);
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const lower = line.toLowerCase();
		for (const { rule, re } of compiled) {
			re.lastIndex = 0;
			let m;
			while ((m = re.exec(line)) !== null) {
				const hit = m[0];
				const at = m.index;
				if (m.index === re.lastIndex) {
					re.lastIndex++;
				}
				if (rule.falsePositiveHints?.some((h) => lower.includes(h.toLowerCase()))) {
					continue;
				}
				if (allowlisted(hit, allow)) {
					continue;
				}
				findings.push({ file, line: i + 1, col: at + 1, rule: rule.id, severity: rule.severity, description: rule.description, snippet: line.trim().slice(0, 200) });
			}
		}
	}
	return findings;
}

function shouldSkip(file, ignoreGlobs) {
	if (SKIP_EXT.has(extname(file).toLowerCase())) {
		return true;
	}
	return ignoreGlobs.some((glob) => file.includes(glob));
}

function walk(dir, root, ignoreGlobs, acc) {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		if (entry.isDirectory()) {
			if (!IGNORE_DIRS.has(entry.name)) {
				walk(join(dir, entry.name), root, ignoreGlobs, acc);
			}
		} else if (entry.isFile()) {
			const abs = join(dir, entry.name);
			const rel = abs.slice(root.length + 1).replace(/\\/g, "/");
			if (!shouldSkip(rel, ignoreGlobs)) {
				acc.push({ rel, abs });
			}
		}
	}
	return acc;
}

function collectFiles(root, ignoreGlobs) {
	try {
		const out = execFileSync("git", ["-C", root, "ls-files"], { encoding: "utf8", maxBuffer: 128 * 1024 * 1024 });
		const files = out.split("\n").map((s) => s.trim()).filter(Boolean).filter((f) => !shouldSkip(f, ignoreGlobs));
		if (files.length) {
			return files.map((rel) => ({ rel, abs: join(root, rel) }));
		}
	} catch {
		// not a git repo; fall back to a directory walk
	}
	return walk(root, root, ignoreGlobs, []);
}

function render(findings, asJson) {
	if (asJson) {
		return JSON.stringify(findings, null, 2);
	}
	if (findings.length === 0) {
		return "gatekeeper: clean, no findings.";
	}
	const out = [];
	for (const sev of SEVERITY_ORDER) {
		for (const f of findings.filter((x) => x.severity === sev)) {
			out.push(`${sev.toUpperCase().padEnd(8)} ${f.file}:${f.line}  ${f.rule}  ${f.description}`);
			out.push(`         ${f.snippet}`);
		}
	}
	const blocking = findings.filter((f) => BLOCKING.has(f.severity)).length;
	out.push("");
	out.push(`gatekeeper: ${blocking} blocking (critical/high), ${findings.length - blocking} to review (medium/info).`);
	return out.join("\n");
}

function main(argv) {
	const asJson = argv.includes("--json");
	const targets = argv.filter((a) => !a.startsWith("--"));
	const root = targets[0] ?? process.cwd();
	if (!existsSync(root)) {
		process.stderr.write(`gatekeeper: path not found: ${root}\n`);
		process.exit(2);
	}
	const config = loadConfig(root);
	const compiled = buildRules(config);
	const findings = [];
	for (const { rel, abs } of collectFiles(root, config.ignoreGlobs)) {
		let content;
		try {
			content = readFileSync(abs, "utf8");
		} catch {
			continue;
		}
		findings.push(...scanText(content, rel, compiled, config.allowedIdentities));
	}
	process.stdout.write(render(findings, asJson) + "\n");
	process.exit(findings.some((f) => BLOCKING.has(f.severity)) ? 1 : 0);
}

const invoked = process.argv[1];
if (invoked && import.meta.url === pathToFileURL(invoked).href) {
	main(process.argv.slice(2));
}
