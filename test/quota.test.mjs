/**
 * Quota-view and quota-transport tests.
 *
 * These cover the dsh-agy 0.3.0 migration that broke the badge: the `/agy`
 * dashboard was replaced by an inline Settings section, the `/agy/api/accounts`
 * HTTP route is gone, and the 5h/weekly windows now arrive as GROUPS from
 * `v1internal:retrieveUserQuotaSummary` over the `/api/agy` RPC.
 *
 * No network, no browser: the transport is driven through a fake `fetch` and a
 * fake RPC, exactly as dsh-agy's own suite forbids real HTTP in unit tests.
 */
import assert from "node:assert/strict";
import {
  buildQuotaCards,
  createAgyRpc,
  describeSource,
  desensitizeEmail,
  dotStateFor,
  formatLimitsAge,
  formatWindowReset,
  limitsAreFresh,
  loadAgyState,
  mergeLimits,
  pickBadgePercent,
  pickBadgeQuota,
  quotaColor,
  quotaColorForWindow,
  readLegacyAccounts,
  readLinkQuotas,
  sortWindows,
  stateLabel,
  toPercent,
  windowLabel,
  AGY_RPC_CHANNEL,
  AGY_RPC_ENDPOINT,
  LIMITS_TTL_MS
} from "../dist/index.js";

const HOUR = 3600_000;
const DAY = 24 * HOUR;
const NOW = Date.parse("2026-03-10T12:00:00.000Z");
const iso = (offsetMs) => new Date(NOW + offsetMs).toISOString();

// ─── window vocabulary ───────────────────────────────────────────────────────

assert.equal(windowLabel("5h"), "5小时周期");
assert.equal(windowLabel("weekly"), "周额度");
assert.equal(windowLabel("monthly"), "月额度");
assert.equal(windowLabel("daily"), "日额度");
// An unknown token must survive verbatim rather than be dropped or renamed.
assert.equal(windowLabel("3d"), "3d");
console.log("✓ window labels (including an unknown token carried verbatim)");

const sorted = sortWindows([
  { bucketId: "g-monthly", window: "monthly" },
  { bucketId: "g-3d", window: "3d" },
  { bucketId: "g-weekly", window: "weekly" },
  { bucketId: "g-5h", window: "5h" },
  { bucketId: "g-daily", window: "daily" }
]);
assert.deepEqual(
  sorted.map((w) => w.window),
  ["5h", "daily", "weekly", "monthly", "3d"],
  "windows sort shortest-first with an unknown token last"
);
console.log("✓ window ordering");

// ─── percentages: unknown is NOT zero ────────────────────────────────────────

assert.equal(toPercent(null), null);
assert.equal(toPercent(undefined), null);
assert.equal(toPercent(NaN), null);
assert.equal(toPercent(Infinity), null);
assert.equal(toPercent(0.826), 83);
assert.equal(toPercent(1.4), 100);
assert.equal(toPercent(-1), 0);
assert.equal(quotaColor(null), "#64748b", "unknown renders grey, never red");
assert.equal(quotaColor(50), "#10b981");
assert.equal(quotaColor(20), "#f59e0b");
assert.equal(quotaColor(5), "#ef4444");
assert.equal(quotaColorForWindow("weekly", 50), "#38bdf8");
assert.equal(quotaColorForWindow("5h", 50), "#10b981");
console.log("✓ percentage mapping (null is grey, not 0%)");

// ─── reset countdowns ────────────────────────────────────────────────────────

assert.equal(formatWindowReset("5h", iso(2 * HOUR), NOW), "2小时0分后重置");
assert.equal(formatWindowReset("5h", iso(25 * 60000), NOW), "25分钟后重置");
assert.equal(formatWindowReset("5h", iso(-HOUR), NOW), "即将重置");
assert.equal(formatWindowReset("weekly", null, NOW), null);
assert.equal(formatWindowReset("weekly", "not-a-date", NOW), null);
assert.match(formatWindowReset("monthly", iso(20 * DAY), NOW), /^\d+月\d+日 \d\d:\d\d \(20天后\)$/);
assert.match(formatWindowReset("weekly", iso(3 * DAY), NOW), /\(3天后\)$/);
console.log("✓ reset countdowns (5h short form, longer windows dated)");

// ─── account presentation ────────────────────────────────────────────────────

assert.equal(desensitizeEmail("ab@x.com"), "a***@x.com");
assert.equal(desensitizeEmail("abcdef@x.com"), "ab***@x.com");
assert.equal(desensitizeEmail("abcdefgh@x.com"), "abcde***@x.com");
assert.equal(desensitizeEmail(null), "—");
assert.equal(stateLabel("active"), "正常");
assert.equal(stateLabel("cooling"), "冷却中");
// dsh-agy 0.3.0 added this state and removed 'rate-limited'.
assert.equal(stateLabel("verification-required"), "待验证");
assert.equal(stateLabel("disabled"), "已禁用");

assert.equal(dotStateFor([]), "disabled");
assert.equal(dotStateFor([{ active: true, state: "active" }]), "active");
assert.equal(dotStateFor([{ active: false, state: "cooling" }]), "cooling");
assert.equal(
  dotStateFor([{ active: true, state: "active" }, { active: false, state: "verification-required" }]),
  "cooling",
  "a parked account must not read as a healthy pool"
);

assert.equal(formatLimitsAge(NOW - 30_000, NOW), "刚刚");
assert.equal(formatLimitsAge(NOW - 5 * 60000, NOW), "5 分钟前");
assert.equal(formatLimitsAge(NOW - 3 * HOUR, NOW), "3 小时前");
assert.equal(formatLimitsAge(NOW - 2 * DAY, NOW), "2 天前");
assert.equal(formatLimitsAge(null, NOW), null);
console.log("✓ account email/state/dot/age presentation");

// ─── the grouped shape that replaced the per-model one ───────────────────────

/** The measured live payload: two groups, the second covering Claude AND GPT. */
const measuredLimits = [
  {
    name: "Gemini Models",
    windows: [
      { bucketId: "gemini-5h", window: "5h", remainingFraction: 0.82, resetTime: iso(2 * HOUR) },
      { bucketId: "gemini-weekly", window: "weekly", remainingFraction: 0.44, resetTime: iso(3 * DAY) },
      { bucketId: "gemini-monthly", window: "monthly", remainingFraction: 0.9, resetTime: iso(20 * DAY) }
    ]
  },
  {
    name: "Claude and GPT models",
    windows: [
      { bucketId: "3p-weekly", window: "weekly", remainingFraction: 0.12, resetTime: iso(2 * DAY) },
      { bucketId: "3p-daily", window: "daily", remainingFraction: null, resetTime: null }
    ]
  }
];

const groupedAccount = { index: 0, email: "a@b.com", projectId: "p", active: true, state: "active", limits: measuredLimits, limitsUpdatedAt: NOW };

const cards = buildQuotaCards(groupedAccount, null, NOW);
assert.equal(cards.length, 2, "upstream groups pass through one card each");
assert.equal(cards[0].title, "Gemini Models");
assert.equal(cards[0].badgeTag, "Google");
// The monthly window is the whole point of the migration and must render.
assert.deepEqual(cards[0].windows.map((w) => w.label), ["5小时周期", "周额度", "月额度"]);
assert.deepEqual(cards[0].windows.map((w) => w.percent), [82, 44, 90]);
assert.equal(cards[0].windows[0].reset, "2小时0分后重置");
assert.equal(cards[1].title, "Claude and GPT models");
assert.equal(cards[1].badgeTag, "Claude + GPT", "the 3p group covers Claude AND GPT, so it needs its own tag");
assert.deepEqual(cards[1].windows.map((w) => w.label), ["日额度", "周额度"]);
assert.equal(cards[1].windows[0].percent, null, "an unreported window stays unknown");
assert.equal(cards[1].windows[0].color, "#64748b");
assert.equal(cards[1].windows[1].percent, 12);
console.log("✓ grouped cards (5h/weekly/monthly, unknown window grey)");

// A group with no usable window must not render an empty card.
const emptyGroupCards = buildQuotaCards(
  { ...groupedAccount, limits: [{ name: "Empty", windows: [] }, measuredLimits[0]] },
  null,
  NOW
);
assert.equal(emptyGroupCards.length, 1);
assert.equal(emptyGroupCards[0].title, "Gemini Models");
console.log("✓ empty groups are dropped");

// ─── compatibility ladder ────────────────────────────────────────────────────

const linkQuotas = {
  google: { remainingFraction: 0.5, resetTime: iso(HOUR), weeklyFraction: 0.2, weeklyResetTime: iso(4 * DAY) },
  anthropic: { remainingFraction: 0.7, resetTime: iso(HOUR) },
  openai: { remainingFraction: 0.9, resetTime: iso(HOUR) }
};
const linkCards = buildQuotaCards({ ...groupedAccount, limits: null }, linkQuotas, NOW);
assert.deepEqual(linkCards.map((c) => c.badgeTag), ["Google", "Anthropic", "OpenAI"]);
assert.deepEqual(linkCards[0].windows.map((w) => w.label), ["5小时周期", "周额度"]);
assert.deepEqual(linkCards[1].windows.map((w) => w.label), ["5小时周期"], "no weekly reported, no weekly row");

const legacyAccount = {
  index: 0,
  email: "a@b.com",
  projectId: null,
  active: true,
  state: "active",
  limits: null,
  limitsUpdatedAt: null,
  quota: { modelCount: 2, models: [{ id: "gemini-3.8-flash-tiered", remainingFraction: 0.31, resetTime: iso(HOUR) }] }
};
const legacyCards = buildQuotaCards(legacyAccount, null, NOW);
assert.equal(legacyCards.length, 1);
assert.equal(legacyCards[0].windows[0].percent, 31);
assert.deepEqual(buildQuotaCards(undefined, null, NOW), []);
console.log("✓ fallback ladder (grouped → agy-link families → legacy per-model)");

// ─── badge percentage priority ───────────────────────────────────────────────

assert.equal(pickBadgePercent([groupedAccount], { google: { remainingFraction: 0.5 } }), 82, "the grouped 5h window wins");
assert.equal(pickBadgePercent([{ ...groupedAccount, limits: null }], linkQuotas), 50);
assert.equal(pickBadgePercent([legacyAccount], null), 31);
assert.equal(pickBadgePercent([], null), null, "nothing known must be null, never 0");
// No 5h anywhere: fall back to the shortest window the pool does report.
assert.equal(
  pickBadgePercent([{ ...groupedAccount, limits: [{ name: "Only weekly", windows: [{ bucketId: "3p-weekly", window: "weekly", remainingFraction: 0.33, resetTime: null }] }] }], null),
  33
);
console.log("✓ badge percentage priority");

// ─── badge must follow the BINDING window, not the 5h one ────────────────────

// A nearly spent WEEK is what actually stops a request; the old rule read only
// the 5-hour bucket and kept showing 90% for an account that could not serve.
const spentWeek = (fraction) => ({
  ...groupedAccount,
  limits: [{
    name: "Gemini Models",
    windows: [
      { bucketId: "gemini-5h", window: "5h", remainingFraction: 0.9, resetTime: iso(2 * HOUR) },
      { bucketId: "gemini-weekly", window: "weekly", remainingFraction: fraction, resetTime: iso(3 * DAY) }
    ]
  }]
});
assert.equal(pickBadgePercent([spentWeek(0.005)], null), 1, "a nearly spent week outranks a healthy 5h window");
assert.equal(pickBadgePercent([spentWeek(0)], null), 0, "an exhausted week reads 0%");
assert.equal(pickBadgeQuota([spentWeek(0.005)], null).window, "weekly", "and the reading names the weekly window");
// The reverse must NOT happen: a comfortable week leaves the five-hour figure in
// charge, which is the regression a raw-minimum rule would have introduced.
assert.equal(pickBadgePercent([groupedAccount], null), 82, "a comfortable week does not drag the 5h figure down");
assert.equal(pickBadgeQuota([groupedAccount], null).window, "5h");
// daily/monthly are reported but never block, so they must never drive the badge.
assert.equal(
  pickBadgeQuota([{
    ...groupedAccount,
    limits: [{
      name: "Gemini Models",
      windows: [
        { bucketId: "gemini-5h", window: "5h", remainingFraction: 0.9, resetTime: iso(2 * HOUR) },
        { bucketId: "gemini-monthly", window: "monthly", remainingFraction: 0.01, resetTime: iso(20 * DAY) }
      ]
    }]
  }], null).percent,
  90,
  "a low monthly window is not an alarm"
);
// The dsh-agy-link pool reports the same two windows and is read the same way.
assert.equal(
  pickBadgePercent([{ ...groupedAccount, limits: null }], { google: { remainingFraction: 0.8, weeklyFraction: 0.004 } }),
  0,
  "a spent week in the link pool drives the badge too"
);
assert.equal(
  pickBadgePercent([{ ...groupedAccount, limits: null }], { google: { remainingFraction: 0.8, weeklyFraction: 0.5 } }),
  80,
  "a healthy link week leaves the link 5h figure in charge"
);
console.log("✓ badge follows the binding window (5h vs weekly)");

assert.match(describeSource("agy-rpc"), /dsh-agy/);
assert.notEqual(describeSource("none"), undefined);
console.log("✓ source captions");

// ─── RPC transport ───────────────────────────────────────────────────────────

const calls = [];
const okRpc = (value) => ({
  rpc: {
    call: async (channel, endpoint, payload) => {
      calls.push({ channel, endpoint, payload });
      return { ok: true, value };
    }
  }
});

const rpc = createAgyRpc(okRpc({ accounts: [groupedAccount] }));
assert.ok(rpc, "a connection with rpc.call yields a caller");
await rpc.call("account.list", {});
assert.equal(calls[0].channel, AGY_RPC_CHANNEL);
assert.equal(calls[0].endpoint, AGY_RPC_ENDPOINT);
assert.deepEqual(calls[0].payload, { method: "account.list", payload: {} });
assert.equal(calls[0].payload.method, "account.list");
console.log("✓ RPC envelope and channel addressing");

assert.equal(createAgyRpc(null), null);
assert.equal(createAgyRpc({}), null, "a connection without rpc.call yields no caller");

await assert.rejects(
  () => createAgyRpc({ rpc: { call: async () => ({ ok: false, error: { message: "pool is empty" } }) } }).call("account.list", {}),
  /pool is empty/
);
await assert.rejects(
  () => createAgyRpc({ rpc: { call: async () => ({}) } }).call("account.list", {}),
  /malformed agy RPC response/,
  "an unrecognized envelope must not read as an empty pool"
);
console.log("✓ RPC error handling");

// ─── loadAgyState: channel selection and probe gating ────────────────────────

const linkBody = { pool: { accounts: [{ quotas: { google: { remainingFraction: 0.5 } } }] } };
const fakeFetch = (routes) => async (url) => {
  const body = routes[url];
  if (body === undefined) return { ok: false, json: async () => ({}) };
  return { ok: true, json: async () => body };
};

const freshAccount = { ...groupedAccount, limitsUpdatedAt: Date.now() };
const staleAccount = { ...groupedAccount, limits: null, limitsUpdatedAt: null };

function rpcStub(accounts, limitsReply) {
  const seen = [];
  return {
    seen,
    call: async (method, payload) => {
      seen.push({ method, payload });
      if (method === "account.list") return { accounts };
      if (method === "account.limits") return limitsReply;
      throw new Error("unexpected method " + method);
    }
  };
}

// auto: stale snapshot → probe
{
  const stub = rpcStub([staleAccount], { limits: [{ index: 0, groups: measuredLimits, updatedAt: NOW }], measured: 1, failed: 0, skipped: 0 });
  const state = await loadAgyState({ rpc: stub, limits: "auto", fetchImpl: fakeFetch({ "/plugins/agy-link/status": linkBody }) });
  assert.equal(state.accountSource, "agy-rpc");
  assert.deepEqual(stub.seen.map((c) => c.method), ["account.list", "account.limits"]);
  assert.deepEqual(stub.seen[1].payload, {}, "an automatic probe must not force");
  assert.equal(state.accounts[0].limits, measuredLimits, "the reply's groups land on the account row");
  assert.equal(state.limits.measured, 1);
  assert.equal(state.linkQuotas.google.remainingFraction, 0.5, "the link channel is independent of the RPC");
}
console.log("✓ auto probe when the snapshot is stale");

// auto: fresh snapshot → NO probe (this is what stops the polling from hammering upstream)
{
  const stub = rpcStub([freshAccount], { limits: [], measured: 0, failed: 0, skipped: 0 });
  const state = await loadAgyState({ rpc: stub, limits: "auto", fetchImpl: fakeFetch({}) });
  assert.deepEqual(stub.seen.map((c) => c.method), ["account.list"]);
  assert.equal(state.limits, null);
}
console.log("✓ auto probe skipped inside the TTL");

// force: the user's refresh bypasses the TTL
{
  const stub = rpcStub([freshAccount], { limits: [], measured: 1, failed: 0, skipped: 0 });
  await loadAgyState({ rpc: stub, limits: "force", fetchImpl: fakeFetch({}) });
  assert.deepEqual(stub.seen.map((c) => c.method), ["account.list", "account.limits"]);
  assert.deepEqual(stub.seen[1].payload, { force: true });
}
console.log("✓ forced probe on explicit refresh");

// off: the back-off path never probes
{
  const stub = rpcStub([staleAccount], { limits: [], measured: 0, failed: 1, skipped: 0 });
  await loadAgyState({ rpc: stub, limits: "off", fetchImpl: fakeFetch({}) });
  assert.deepEqual(stub.seen.map((c) => c.method), ["account.list"]);
}
console.log("✓ probe suppressed during back-off");

// no RPC → the legacy HTTP channel
{
  const legacyRow = { index: 0, email: "a@b.com", active: true, state: "active", quota: { modelCount: 1, models: [] } };
  const state = await loadAgyState({
    rpc: null,
    limits: "auto",
    fetchImpl: fakeFetch({ "/agy/api/accounts": { accounts: [legacyRow] } })
  });
  assert.equal(state.accountSource, "legacy-http");
  assert.equal(state.accounts.length, 1);
}
console.log("✓ legacy HTTP fallback when no RPC is available");

// neither channel answers → 'none', and the caller keeps its last good rows
{
  const state = await loadAgyState({ rpc: null, limits: "auto", fetchImpl: fakeFetch({}) });
  assert.equal(state.accountSource, "none");
  assert.deepEqual(state.accounts, []);
  assert.equal(state.linkQuotas, null);
}
console.log("✓ no channel reports 'none' instead of inventing an empty pool");

// A failing RPC must fall through to the legacy route rather than blanking.
{
  const failing = { call: async () => { throw new Error("connection closed"); } };
  const state = await loadAgyState({
    rpc: failing,
    limits: "auto",
    fetchImpl: fakeFetch({ "/agy/api/accounts": { accounts: [legacyAccount] } })
  });
  assert.equal(state.accountSource, "legacy-http");
  assert.equal(state.error, "connection closed");
}
console.log("✓ a broken RPC degrades to the legacy route");

// ─── small readers ───────────────────────────────────────────────────────────

assert.equal(readLinkQuotas({ pool: { accounts: [{ quotas: linkQuotas }] } }), linkQuotas);
assert.equal(readLinkQuotas({ pool: { accounts: [] } }), null);
assert.equal(readLinkQuotas(null), null);
assert.equal(readLegacyAccounts({ accounts: [legacyAccount] }).length, 1);
assert.deepEqual(readLegacyAccounts({ nope: true }), []);

const merged = mergeLimits([groupedAccount], [{ index: 0, groups: null, updatedAt: null }]);
assert.equal(merged[0].limits, null);
assert.equal(merged[0].limitsUpdatedAt, null);
assert.deepEqual(mergeLimits([groupedAccount], []), [groupedAccount]);

assert.equal(limitsAreFresh([freshAccount]), true);
assert.equal(limitsAreFresh([staleAccount]), false);
assert.equal(limitsAreFresh([{ ...groupedAccount, limitsUpdatedAt: Date.now() - LIMITS_TTL_MS - 1 }]), false);
assert.equal(limitsAreFresh([]), true);
console.log("✓ payload readers and cache-freshness check");

console.log("\nALL QUOTA TESTS PASSED!");
