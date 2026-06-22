#!/usr/bin/env node
// @jayofemi/toolbox installer: copy selected skills and commands into a Claude
// Code config. Zero-dependency Node ESM, no build step.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, cpSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createInterface } from "node:readline";

const PKG_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/** Read the description from YAML frontmatter, folding a block scalar to one line. */
export function frontmatterDescription(text) {
	const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!m) {
		return "";
	}
	const lines = m[1].split(/\r?\n/);
	const i = lines.findIndex((l) => /^description\s*:/.test(l));
	if (i === -1) {
		return "";
	}
	const inline = lines[i].replace(/^description\s*:/, "").trim();
	if (inline && !/^[|>][+-]?\d*$/.test(inline)) {
		return stripQuotes(inline);
	}
	const body = [];
	for (let j = i + 1; j < lines.length; j++) {
		if (lines[j].trim() === "") {
			continue;
		}
		if (!/^\s/.test(lines[j])) {
			break;
		}
		body.push(lines[j].trim());
	}
	return body.join(" ");
}

function stripQuotes(s) {
	return s.replace(/^(['"])([\s\S]*)\1$/, "$2");
}

/** Discover the commands and skills bundled in the package. */
export function discoverEntries(root = PKG_ROOT) {
	const entries = [];
	const commandsDir = join(root, "commands");
	if (existsSync(commandsDir)) {
		for (const file of readdirSync(commandsDir)) {
			if (file.endsWith(".md")) {
				const source = join(commandsDir, file);
				entries.push({
					name: basename(file, ".md"),
					type: "command",
					source,
					description: frontmatterDescription(readFileSync(source, "utf8")),
				});
			}
		}
	}
	const skillsDir = join(root, "skills");
	if (existsSync(skillsDir)) {
		for (const skillDir of findSkillDirs(skillsDir)) {
			entries.push({
				name: basename(skillDir),
				type: "skill",
				source: skillDir,
				description: frontmatterDescription(readFileSync(join(skillDir, "SKILL.md"), "utf8")),
			});
		}
	}
	return entries.sort((a, b) => a.name.localeCompare(b.name));
}

// A skill is any directory holding a SKILL.md, one or two levels under skills/.
function findSkillDirs(skillsDir) {
	const found = [];
	for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
		if (!entry.isDirectory()) {
			continue;
		}
		const level1 = join(skillsDir, entry.name);
		if (existsSync(join(level1, "SKILL.md"))) {
			found.push(level1);
			continue;
		}
		for (const sub of readdirSync(level1, { withFileTypes: true })) {
			if (sub.isDirectory() && existsSync(join(level1, sub.name, "SKILL.md"))) {
				found.push(join(level1, sub.name));
			}
		}
	}
	return found;
}

function targetFor(entry, base) {
	return entry.type === "command"
		? join(base, ".claude", "commands", `${entry.name}.md`)
		: join(base, ".claude", "skills", entry.name);
}

/** Install one entry under base (defaults to the home directory). */
export function installEntry(entry, base = homedir()) {
	const target = targetFor(entry, base);
	const existed = existsSync(target);
	mkdirSync(dirname(target), { recursive: true });
	if (entry.type === "command") {
		writeFileSync(target, readFileSync(entry.source, "utf8"));
	} else {
		cpSync(entry.source, target, { recursive: true });
	}
	return existed ? "updated" : "installed";
}

function printUsage() {
	process.stdout.write(
		"toolbox - install Claude Code skills and commands\n\n" +
		"Usage:\n" +
		"  npx @jayofemi/toolbox             pick from a list and install\n" +
		"  npx @jayofemi/toolbox list        show everything available\n" +
		"  npx @jayofemi/toolbox add <name>  install one or more by name\n\n" +
		"Entries install into ~/.claude (skills/ and commands/).\n",
	);
}

function printList(entries) {
	for (const e of entries) {
		process.stdout.write(`  ${e.name}  [${e.type}]  ${e.description}\n`);
	}
}

async function promptSelection(entries) {
	entries.forEach((e, i) => {
		process.stdout.write(`  ${i + 1}. ${e.name} [${e.type}] - ${e.description}\n`);
	});
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	const answer = await new Promise((resolve) => {
		rl.question("\nInstall which? (numbers or names, comma separated, or 'all'): ", resolve);
	});
	rl.close();
	const tokens = answer.split(",").map((t) => t.trim()).filter(Boolean);
	if (tokens.some((t) => t.toLowerCase() === "all")) {
		return entries;
	}
	const chosen = [];
	for (const token of tokens) {
		const entry = /^\d+$/.test(token) ? entries[Number(token) - 1] : entries.find((e) => e.name === token);
		if (entry && !chosen.includes(entry)) {
			chosen.push(entry);
		}
	}
	return chosen;
}

async function main(argv) {
	const positional = argv.filter((a) => !a.startsWith("--"));
	const command = positional[0];
	const entries = discoverEntries();
	if (command === "list") {
		printList(entries);
		return 0;
	}
	let selected;
	if (command === "add") {
		const names = positional.slice(1);
		selected = entries.filter((e) => names.includes(e.name));
		const missing = names.filter((n) => !entries.some((e) => e.name === n));
		if (missing.length) {
			process.stderr.write(`unknown: ${missing.join(", ")}\n`);
		}
		if (!selected.length) {
			printUsage();
			return 1;
		}
	} else if (!command) {
		if (!process.stdin.isTTY) {
			printUsage();
			printList(entries);
			return 0;
		}
		selected = await promptSelection(entries);
	} else {
		printUsage();
		return 1;
	}
	for (const entry of selected) {
		const result = installEntry(entry);
		process.stdout.write(`${result}: ${entry.name} [${entry.type}]\n`);
	}
	return 0;
}

const invoked = process.argv[1];
if (invoked && import.meta.url === pathToFileURL(invoked).href) {
	main(process.argv.slice(2)).then((code) => process.exit(code ?? 0));
}
