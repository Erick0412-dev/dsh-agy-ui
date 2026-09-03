import assert from "node:assert/strict";
import {
  isGhostModel,
  formatTieredModelName,
  isFoldedVariant,
  wrapAdapter,
  WRAPPED_FLAG
} from "../dist/index.js";

// 1. Ghost model tests
assert.equal(isGhostModel("chat_23310"), true);
assert.equal(isGhostModel("chat_20706"), true);
assert.equal(isGhostModel("tab_flash_lite_preview"), true);
assert.equal(isGhostModel("tab_jump_flash_lite_preview"), true);
assert.equal(isGhostModel("gemini-3.8-flash-tiered"), false);
assert.equal(isGhostModel("gemini-3.1-flash-lite"), false);
assert.equal(isGhostModel("gemini-3.1-flash-image"), false);
assert.equal(isGhostModel("gemini-2.5-flash"), false);
assert.equal(isGhostModel("claude-sonnet-4-6"), false);
assert.equal(isGhostModel("gpt-oss-120b-medium"), false);
console.log("✓ Ghost model tests passed (lite, image, 2.5 are not ghost)");

// 2. Format name
assert.equal(formatTieredModelName("gemini-3.8-flash-tiered"), "Gemini 3.8 Flash");
assert.equal(formatTieredModelName("gemini-3.7-flash-tiered"), "Gemini 3.7 Flash");
assert.equal(formatTieredModelName("gemini-3.6-flash-tiered"), "Gemini 3.6 Flash");
console.log("✓ Formatting tests passed");

// 3. Folding
assert.equal(isFoldedVariant("gemini-3.6-flash-low"), true);
assert.equal(isFoldedVariant("gemini-3.6-flash-high"), true);
assert.equal(isFoldedVariant("gemini-3.1-pro-low"), true);
assert.equal(isFoldedVariant("gemini-pro-agent"), true);
assert.equal(isFoldedVariant("gemini-3.1-flash-lite"), false);
assert.equal(isFoldedVariant("gemini-2.5-flash"), false);
assert.equal(isFoldedVariant("claude-sonnet-4-6"), false);
console.log("✓ Folding tests passed");

// 4. Wrap adapter test with comprehensive model list
const mockAdapter = {
  async listModels(provider) {
    return [
      { provider: "agy", id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite" },
      { provider: "agy", id: "gemini-3.1-flash-lite", name: "Gemini 3.1 Flash Lite" },
      { provider: "agy", id: "gemini-3.1-flash-image", name: "Gemini 3.1 Flash Image" },
      { provider: "agy", id: "gemini-pro-agent", name: "Gemini 3.1 Pro (High)" },
      { provider: "agy", id: "gemini-3.6-flash-low", name: "Gemini 3.6 Flash (Low)" },
      { provider: "agy", id: "gemini-3.1-pro-low", name: "Gemini 3.1 Pro (Low)" },
      { provider: "agy", id: "gemini-2.5-flash-thinking", name: "Gemini 2.5 Flash Thinking" },
      { provider: "agy", id: "gemini-3.7-flash-tiered", name: "gemini-3.7-flash-tiered" },
      { provider: "agy", id: "gemini-3-flash", name: "Gemini 3 Flash" },
      { provider: "agy", id: "gemini-3.5-flash-low", name: "Gemini 3.5 Flash (Medium)" },
      { provider: "agy", id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
      { provider: "agy", id: "gemini-3.6-flash-tiered", name: "gemini-3.6-flash-tiered" },
      { provider: "agy", id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
      { provider: "agy", id: "gemini-3.5-flash-extra-low", name: "Gemini 3.5 Flash (Low)" },
      { provider: "agy", id: "gemini-3.8-flash-tiered", name: "gemini-3.8-flash-tiered" },
      { provider: "agy", id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
      { provider: "agy", id: "chat_23310", name: "chat_23310" },
      { provider: "agy", id: "tab_flash_lite_preview", name: "tab_flash_lite_preview" },
      { provider: "agy", id: "claude-opus-4-6-thinking", name: "Claude Opus 4.6 (Thinking)" },
      { provider: "agy", id: "gpt-oss-120b-medium", name: "GPT-OSS 120B (Medium)" }
    ];
  },
  async resolveModel(provider, model) {
    return { provider, id: model, name: model };
  },
  async *stream(options) {
    yield options;
  }
};

wrapAdapter(mockAdapter);
const listed = await mockAdapter.listModels("agy");
const listedNames = listed.map(m => m.name);

// Check exact expected order:
assert.deepEqual(listedNames, [
  "Gemini 3.8 Flash",
  "Gemini 3.7 Flash",
  "Gemini 3.6 Flash",
  "Gemini 3.5 Flash",
  "Gemini 3 Flash",
  "Gemini 3.1 Flash Lite",
  "Gemini 3.1 Flash Image",
  "Gemini 3.1 Pro",
  "Gemini 2.5 Pro",
  "Gemini 2.5 Flash",
  "Gemini 2.5 Flash Thinking",
  "Gemini 2.5 Flash Lite",
  "Claude Sonnet 4.6 (Thinking)",
  "Claude Opus 4.6 (Thinking)",
  "GPT-OSS 120B (Medium)"
]);
console.log("✓ Full ordered model list without filtering lite/image/2.5 passed!");

console.log("ALL UNIT TESTS PASSED!");
