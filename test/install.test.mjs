import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { frontmatterDescription, discoverEntries, installEntry, hookWiringSnippet } from "../bin/toolbox.mjs";

test("frontmatterDescription reads the description field", () => {
	const md = "---\ndescription: Does a thing\nargument-hint: [x]\n---\nbody";
	assert.equal(frontmatterDescription(md), "Does a thing");
});

test("frontmatterDescription returns empty without frontmatter", () => {
	assert.equal(frontmatterDescription("# just a heading"), "");
});

test("frontmatterDescription folds a block-scalar description", () => {
	const md = "---\ndescription: >-\n  First part,\n  second part.\nother: x\n---\nbody";
	assert.equal(frontmatterDescription(md), "First part, second part.");
});

test("discoverEntries finds the screenshot command", () => {
	const shot = discoverEntries().find((e) => e.name === "screenshot");
	assert.ok(shot, "screenshot should be discovered");
	assert.equal(shot.type, "command");
	assert.ok(shot.description.length > 0);
});

test("installEntry copies a command into base/.claude/commands", () => {
	const base = mkdtempSync(join(tmpdir(), "toolbox-test-"));
	try {
		const source = join(base, "src.md");
		writeFileSync(source, "---\ndescription: sample\n---\nbody\n");
		const result = installEntry({ name: "sample", type: "command", source }, base);
		assert.equal(result, "installed");
		assert.ok(existsSync(join(base, ".claude", "commands", "sample.md")));
	} finally {
		rmSync(base, { recursive: true, force: true });
	}
});

test("installEntry copies a skill folder into base/.claude/skills", () => {
	const base = mkdtempSync(join(tmpdir(), "toolbox-test-"));
	try {
		const source = join(base, "src-skill");
		mkdirSync(source, { recursive: true });
		writeFileSync(join(source, "SKILL.md"), "---\ndescription: sample skill\n---\nbody\n");
		const result = installEntry({ name: "demo", type: "skill", source }, base);
		assert.equal(result, "installed");
		assert.ok(existsSync(join(base, ".claude", "skills", "demo", "SKILL.md")));
	} finally {
		rmSync(base, { recursive: true, force: true });
	}
});

test("discoverEntries finds the token-report hook with its event", () => {
	const hook = discoverEntries().find((e) => e.name === "token-report");
	assert.ok(hook, "token-report should be discovered");
	assert.equal(hook.type, "hook");
	assert.equal(hook.event, "Stop");
	assert.ok(hook.description.length > 0);
});

test("discoverEntries finds the four routing agents", () => {
	const agents = discoverEntries().filter((e) => e.type === "agent").map((e) => e.name).sort();
	assert.deepEqual(agents, ["Execute", "Explore", "Plan", "Review"]);
});

test("installEntry copies a hook into base/.claude/hooks", () => {
	const base = mkdtempSync(join(tmpdir(), "toolbox-test-"));
	try {
		const source = join(base, "src.mjs");
		writeFileSync(source, "process.exit(0);\n");
		const result = installEntry({ name: "sample-hook", type: "hook", source, event: "Stop" }, base);
		assert.equal(result, "installed");
		assert.ok(existsSync(join(base, ".claude", "hooks", "sample-hook.mjs")));
	} finally {
		rmSync(base, { recursive: true, force: true });
	}
});

test("installEntry copies an agent into base/.claude/agents", () => {
	const base = mkdtempSync(join(tmpdir(), "toolbox-test-"));
	try {
		const source = join(base, "src-agent.md");
		writeFileSync(source, "---\nname: Demo\ndescription: sample agent\nmodel: haiku\n---\nbody\n");
		const result = installEntry({ name: "Demo", type: "agent", source }, base);
		assert.equal(result, "installed");
		assert.ok(existsSync(join(base, ".claude", "agents", "Demo.md")));
	} finally {
		rmSync(base, { recursive: true, force: true });
	}
});

test("hookWiringSnippet groups hooks by event with forward-slash paths", () => {
	const snippet = hookWiringSnippet(
		[
			{ name: "reply-gate", type: "hook", event: "Stop" },
			{ name: "token-report", type: "hook", event: "Stop" },
			{ name: "token-handoff", type: "hook", event: "UserPromptSubmit" },
		],
		"C:\\fake\\home",
	);
	const parsed = JSON.parse(snippet);
	assert.equal(parsed.hooks.Stop[0].hooks.length, 2);
	assert.equal(parsed.hooks.UserPromptSubmit[0].hooks.length, 1);
	assert.match(parsed.hooks.Stop[0].hooks[0].command, /^node "C:\/fake\/home\/.claude\/hooks\/reply-gate.mjs"$/);
});
