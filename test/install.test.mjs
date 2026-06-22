import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { frontmatterDescription, discoverEntries, installEntry } from "../bin/toolbox.mjs";

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
