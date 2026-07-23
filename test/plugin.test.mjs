import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (...parts) => JSON.parse(readFileSync(join(root, ...parts), "utf8"));

const pkg = readJson("package.json");
const plugin = readJson(".claude-plugin", "plugin.json");
const marketplace = readJson(".claude-plugin", "marketplace.json");

test("plugin.json version stays in lockstep with package.json", () => {
	assert.equal(plugin.version, pkg.version);
});

test("plugin name is kebab-case", () => {
	assert.match(plugin.name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
});

test("marketplace lists the repo-root plugin under its plugin.json name", () => {
	const entry = marketplace.plugins.find((p) => p.name === plugin.name);
	assert.ok(entry, "marketplace should list the plugin");
	assert.equal(entry.source, "./");
});

test("plugin hooks.json only wires scripts that ship in hooks/", () => {
	const wiring = readJson("hooks", "hooks.json");
	for (const groups of Object.values(wiring.hooks)) {
		for (const group of groups) {
			for (const hook of group.hooks) {
				const m = hook.command.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/(\S+?)"/);
				assert.ok(m, `plugin-rooted path in: ${hook.command}`);
				assert.ok(existsSync(join(root, m[1])), `${m[1]} should exist`);
			}
		}
	}
});

test("every hooks manifest entry has a shipped script and a known event", () => {
	const manifest = readJson("hooks", "manifest.json");
	for (const [name, meta] of Object.entries(manifest)) {
		assert.ok(existsSync(join(root, "hooks", `${name}.mjs`)), `${name}.mjs should exist`);
		assert.ok(["Stop", "UserPromptSubmit", "PreToolUse", "PostToolUse"].includes(meta.event), `${name} event`);
	}
});

test("the npm files whitelist ships every entry-type directory", () => {
	for (const dir of ["bin/", "commands/", "skills/", "hooks/", "agents/"]) {
		assert.ok(pkg.files.includes(dir), `package.json files should include ${dir}`);
	}
});
