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

test("flags a trailing 'at most' hedge", () => {
	assert.ok(ruleIds("Free to use, with a tip jar at most.").includes("ai-tell-trailing-hedge"));
});

test("flags other trailing afterthought hedges", () => {
	assert.ok(ruleIds("The setup takes a minute, if that.").includes("ai-tell-trailing-hedge"));
	assert.ok(ruleIds("On a slow connection it is sluggish at best.").includes("ai-tell-trailing-hedge"));
	assert.ok(ruleIds("It is a digital handshake, if you will.").includes("ai-tell-trailing-hedge"));
	assert.ok(ruleIds("The migration is done, more or less.").includes("ai-tell-trailing-hedge"));
});

test("leaves a leading conditional clean (not a trailing hedge)", () => {
	assert.equal(scanText("If anything breaks, email support and we will fix it.").length, 0);
});

test("leaves a front-positioned qualifier clean", () => {
	assert.equal(scanText("At best, we can ship the update on Friday.").length, 0);
});

test("leaves a mid-sentence bound clean (only clause-final hedges flag)", () => {
	assert.equal(scanText("Each team plan supports at most five active seats.").length, 0);
});

test("flags copy used for site text", () => {
	assert.ok(ruleIds("Please refresh the marketing copy.").includes("copy-misuse"));
});

test("flags a tip jar as surfaced funding intent", () => {
	assert.ok(ruleIds("Free to use, with a tip jar at most.").includes("surface-funding"));
});

test("flags other funding wording surfaced as site text", () => {
	assert.ok(ruleIds("If this saved you time, buy me a coffee.").includes("surface-funding"));
	assert.ok(ruleIds("Donations welcome.").includes("surface-funding"));
	assert.ok(ruleIds("Support this project on Patreon.").includes("surface-funding"));
});

test("leaves customer-support wording clean (not a funding tell)", () => {
	assert.equal(scanText("Email our support team and we will sort it out.").length, 0);
});

test("flags implementation jargon and hype as surface-jargon", () => {
	assert.ok(ruleIds("Your own model does the heavy lifting.").includes("surface-jargon"));
	assert.ok(ruleIds("It runs on-device and works out of the box.").includes("surface-jargon"));
	assert.ok(ruleIds("A seamless, blazing fast experience.").includes("surface-jargon"));
});

test("leaves plain 'local version' wording clean (not jargon)", () => {
	assert.equal(scanText("Get the local version. Install this tool locally to do more than check.").length, 0);
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

test("leaves an 'include' list-introducer colon clean", () => {
	assert.equal(scanText("Skills I have strengthened include: prompt engineering, evals, and guardrails.").length, 0);
});

test("flags the announced-structure opener", () => {
	assert.ok(ruleIds("I've worked with MCP from both sides.").includes("ai-tell-announce"));
	assert.ok(ruleIds("I have also worked the server side.").includes("ai-tell-announce"));
});

test("leaves a plain 'on the X side' clause opener clean", () => {
	assert.equal(scanText("On the server side, I built and shipped the API.").length, 0);
});

test("flags the gluey filler transition", () => {
	assert.ok(ruleIds("Around that, I use a handful of tools.").includes("ai-tell-glue"));
	assert.ok(ruleIds("The core works. On top of that, it is fast.").includes("ai-tell-glue"));
});

test("leaves a literal mid-clause 'around that' clean", () => {
	assert.equal(scanText("We built the whole flow around that constraint.").length, 0);
});

test("flags the over-qualified which-and-which noun", () => {
	const text = "Claude Code, the tool which I run daily and which is my primary client.";
	assert.ok(ruleIds(text).includes("ai-tell-over-qualify"));
});
