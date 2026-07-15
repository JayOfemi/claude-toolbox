import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
