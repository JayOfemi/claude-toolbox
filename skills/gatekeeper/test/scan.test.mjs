import { test } from "node:test";
import assert from "node:assert/strict";
import { scanText, buildRules } from "../scripts/scan.mjs";

// Secret-like and path-like fixtures are built at runtime by concatenation so
// this file holds no literal secret or leak that a scanner would flag.

const compiled = buildRules({ denyTerms: ["acme-internal"] });

function scan(text, allow = []) {
	return scanText(text, "(test)", compiled, allow);
}
function ruleIds(text) {
	return scan(text).map((f) => f.rule);
}

test("detects an AWS access key id", () => {
	const key = "AKIA" + "ABCDEFGHIJKLMNOP";
	assert.ok(ruleIds(`const k = "${key}"`).includes("aws-access-key-id"));
});

test("detects a private key block", () => {
	const header = "-----BEGIN " + "PRIVATE KEY-----";
	assert.ok(ruleIds(header).includes("private-key-block"));
});

test("detects a local filesystem path", () => {
	const p = "/home/" + "alice/project/notes.txt";
	assert.ok(ruleIds(`see ${p}`).includes("local-filesystem-path"));
});

test("detects a configured deny term", () => {
	assert.ok(ruleIds("this mentions acme-internal by name").some((r) => r.startsWith("deny-term-")));
});

test("ignores a placeholder secret assignment", () => {
	assert.equal(scan('password = "your-password-here"').length, 0);
});

test("allowlist suppresses an allowed identity", () => {
	const found = scan("reach us at hi" + "@toolbox.example", ["hi" + "@toolbox.example"]);
	assert.equal(found.filter((f) => f.rule === "generic-email").length, 0);
});

test("clean text produces no findings", () => {
	assert.equal(scan("This project does one thing well.").length, 0);
});
