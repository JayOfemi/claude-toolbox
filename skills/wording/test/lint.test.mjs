import { test } from "node:test";
import assert from "node:assert/strict";
import { scanText } from "../scripts/lint.mjs";

// Dash fixtures use \u escapes so this file holds no literal em/en dash and
// stays clean under its own rule. \u2014 is an em dash, \u2013 an en dash.

function ruleIds(text) {
	return scanText(text).map((f) => f.rule);
}
function hardFails(text) {
	return scanText(text).filter((f) => f.severity === "fail");
}

test("flags an em dash as a hard fail", () => {
	assert.equal(hardFails("fast service \u2014 guaranteed").length, 1);
});

test("flags an en dash as a hard fail", () => {
	assert.equal(hardFails("open 9\u20135 daily").length, 1);
});

test("does not flag plain ASCII hyphens", () => {
	assert.equal(scanText("open weekdays 9-5, best-of-breed tools").length, 0);
});

test("flags the No X, just Y punch", () => {
	assert.ok(ruleIds("No run arounds, just results.").includes("ai-tell-no-just"));
});

test("flags a bare 'not X, it is Y' reversal", () => {
	const text = "This is not a feature, it is a promise.";
	assert.ok(ruleIds(text).includes("ai-tell-reversal-bare"));
});

test("flags the it-is-not-X-it-is-Y reversal", () => {
	assert.ok(ruleIds("It is not a feature. It is a philosophy.").includes("ai-tell-reversal"));
});

test("flags the you get X, not Y punch", () => {
	assert.ok(ruleIds("You get clarity, not chaos.").includes("ai-tell-you-get"));
});

test("flags the dismissive close", () => {
	assert.ok(ruleIds("It does one thing. That's the whole product.").includes("ai-tell-dismissive-close"));
});

test("flags copy used for site text", () => {
	assert.ok(ruleIds("Please refresh the marketing copy.").includes("copy-misuse"));
});

test("leaves a clean sentence alone", () => {
	const text = "We help small teams ship better software with less stress.";
	assert.equal(scanText(text).length, 0);
});

test("leaves allowed informational contrast clean", () => {
	assert.equal(scanText("We charge fixed prices, not open ended hourly rates.").length, 0);
});

test("does not treat copy-the-file as a violation", () => {
	assert.equal(scanText("Copy the file to the server, then keep a copy of the log.").length, 0);
});

test("flags a colon standing in for an em dash", () => {
	const text = "I build production software: web apps, mobile apps, and automations.";
	assert.ok(ruleIds(text).includes("colon-elaboration"));
});

test("leaves clock-time and ratio colons clean", () => {
	assert.equal(scanText("The standup is at 12:30 today and the split held at 3:1.").length, 0);
});

test("leaves a genuine label lead-in colon clean", () => {
	assert.equal(scanText("Note: see the section below for the full setup.").length, 0);
});
