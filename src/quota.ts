/**
 * Pure quota-view helpers, shared by the Node entry (so they are unit-testable
 * without a browser) and the browser bundle.
 *
 * WHY THIS SHAPE. dsh-agy >= 0.3.0 replaced the per-model `quotaInfo` view with
 * the grouped 5-hour / weekly windows of `v1internal:retrieveUserQuotaSummary`,
 * served over the `/api/agy` management RPC (`account.list` + `account.limits`).
 * Two consequences the old client code could not survive:
 *
 *   1. The `/agy/api/accounts` HTTP route is GONE — the `/agy` dashboard was
 *      replaced by an inline Settings section, and management moved behind DSH's
 *      own RPC channel. A `fetch('/agy/api/accounts')` is now a 404.
 *   2. Windows are per GROUP, not per model, and upstream's group split
 *      ("Gemini Models" / "Claude and GPT models") cannot be re-derived from
 *      model-id prefixes: `3p-*` covers Claude AND GPT. So the display carries
 *      upstream's groups through verbatim instead of hardcoding families.
 *
 * The window vocabulary is `5h` | `daily` | `weekly` | `monthly`, plus any
 * token upstream adds later (carried through and rendered verbatim, never
 * dropped). A window with no reported fraction is "unknown" and renders as an em
 * dash — never as 0%, because unknown headroom and no headroom are opposite
 * facts (the same distinction dsh-agy's own panel draws).
 *
 * No React, no fetch, no DOM in this module.
 */

/** One window of one group, as `retrieveUserQuotaSummary` reports it. */
export interface QuotaWindow {
  /** Upstream's own bucket id, e.g. `gemini-5h`, `3p-weekly`, `gemini-monthly`. */
  bucketId: string;
  /** Upstream's window token: `5h` | `daily` | `weekly` | `monthly`. */
  window: string;
  /** 0..1, or null when upstream omitted it (unknown, not empty). */
  remainingFraction: number | null;
  /** RFC3339 reset moment, or null when upstream omitted it. */
  resetTime: string | null;
}

/** One group of models sharing its window set. */
export interface QuotaGroup {
  /** Upstream's group label, e.g. `Gemini Models`. */
  name: string;
  windows: QuotaWindow[];
}

/** A pre-0.3.0 per-model quota row (`fetchAvailableModels`' `quotaInfo`). */
export interface LegacyModelQuota {
  id: string;
  remainingFraction: number;
  resetTime: string | null;
}

/** A pre-0.3.0 account quota envelope. */
export interface LegacyQuota {
  modelCount: number;
  models: LegacyModelQuota[];
}

/**
 * One account as the `/api/agy` RPC returns it (`account.list`).
 *
 * Mirrors `AccountView` in dsh-agy's `rpc-contract.ts`, minus the fields this
 * plugin does not render. `limits` rides the list reply from a TTL cache and
 * costs no upstream call; `account.limits` is the separate probe.
 */
export interface AgyAccountView {
  index: number;
  email: string | null;
  projectId: string | null;
  /** True when this is the pool's active account and it is not disabled. */
  active: boolean;
  /**
   * `active` | `cooling` | `verification-required` | `disabled`.
   *
   * dsh-agy 0.3.0 dropped the old `rate-limited` member (a rate limit is a
   * cooldown, i.e. `cooling`) and added `verification-required`, which is a
   * park rather than a failure.
   */
  state: string;
  /** ISO timestamp while cooling, else null. */
  cooldownUntil: string | null;
  /** Why the account is cooling, or null when it is not. */
  cooldownReason: string | null;
  /** When the current cooldown began, as an ISO timestamp. */
  cooldownSetAt: string | null;
  /** Appeal link from an upstream verification challenge, when one was supplied. */
  verificationUrl: string | null;
  /** True while the account is parked behind a verification challenge. */
  verificationRequired: boolean;
  /** Grouped 5h/weekly/monthly windows, or null when not yet measured. */
  limits: QuotaGroup[] | null;
  /** When `limits` was measured (Unix ms), or null when never. */
  limitsUpdatedAt: number | null;
  /** Pre-0.3.0 per-model quota, present only on the legacy HTTP channel. */
  quota?: LegacyQuota;
}

/** One family's quota as `dsh-agy-link`'s `/plugins/agy-link/status` reports it. */
export interface FamilyQuotaInfo {
  remainingFraction?: number;
  resetTime?: string | null;
  weeklyFraction?: number;
  weeklyResetTime?: string | null;
  description?: string;
}

/** The `dsh-agy-link` pool quotas, used as a secondary source. */
export interface AgyLinkQuotas {
  google?: FamilyQuotaInfo;
  anthropic?: FamilyQuotaInfo;
  openai?: FamilyQuotaInfo;
}

/** Which channel produced the numbers on screen. */
export type AgyQuotaSource = "agy-rpc" | "agy-link" | "legacy-http" | "none";

/** One rendered window row. */
export interface QuotaWindowRow {
  bucketId: string;
  /** Localized label (`5小时周期` / `周额度` / …). */
  label: string;
  /** 0..100, or null when upstream reported no fraction. */
  percent: number | null;
  /** Bar colour for `percent`; grey when unknown. */
  color: string;
  /** Reset countdown text, or null when there is no usable reset moment. */
  reset: string | null;
}

/** One rendered group card. */
export interface QuotaCard {
  key: string;
  title: string;
  /** Small family tag beside the title. */
  badgeTag: string;
  windows: QuotaWindowRow[];
}

/**
 * Sort rank for an upstream window token: shorter windows first.
 *
 * An explicit table rather than string length: length happens to order today's
 * vocabulary correctly, but `daily` (5 chars) would sort before `weekly` (6) for
 * the wrong reason. An unknown token ranks last, so a window upstream adds later
 * still appears — after the ones we understand.
 */
const WINDOW_RANK: Record<string, number> = { "5h": 0, daily: 1, weekly: 2, monthly: 3 };

/** Localized window labels; an unknown token is its own label. */
const WINDOW_LABELS: Record<string, string> = {
  "5h": "5小时周期",
  daily: "日额度",
  weekly: "周额度",
  monthly: "月额度"
};

/** Label one window token, carrying an unrecognised one through verbatim. */
export function windowLabel(window: string): string {
  return WINDOW_LABELS[window] ?? window;
}

/** Order windows shortest-first; an unknown token last, tie-broken alphabetically. */
export function sortWindows(windows: readonly QuotaWindow[]): QuotaWindow[] {
  return [...windows].sort((a, b) => {
    const ra = WINDOW_RANK[a.window] ?? Number.MAX_SAFE_INTEGER;
    const rb = WINDOW_RANK[b.window] ?? Number.MAX_SAFE_INTEGER;
    return ra - rb || a.window.localeCompare(b.window);
  });
}

/** 0..100 for a usable fraction, or null when it is absent/not finite. */
export function toPercent(fraction: number | null | undefined): number | null {
  if (typeof fraction !== "number" || !Number.isFinite(fraction)) return null;
  const clamped = Math.max(0, Math.min(1, fraction));
  return Math.round(clamped * 100);
}

/** Bar/percent colour for a percentage; grey for "unknown". */
export function quotaColor(percent: number | null): string {
  if (percent === null) return "#64748b";
  if (percent > 30) return "#10b981";
  if (percent > 10) return "#f59e0b";
  return "#ef4444";
}

/** Weekly/monthly bars get their own blue, matching the previous look. */
export function quotaColorForWindow(window: string, percent: number | null): string {
  if (percent === null) return "#64748b";
  if (window === "weekly" || window === "monthly" || window === "daily") {
    if (percent > 30) return "#38bdf8";
    if (percent > 10) return "#f59e0b";
    return "#ef4444";
  }
  return quotaColor(percent);
}

/**
 * Reset countdown for one window.
 *
 * `5h` reads as a short countdown ("2小时10分后重置"), everything longer as an
 * absolute date plus the remaining span ("10月3日 08:00 (3天后)") — the same split
 * the previous implementation used for its two buckets, generalised so a
 * `daily`/`monthly`/`weekly` bucket all read correctly instead of only weekly.
 */
export function formatWindowReset(window: string, resetTime: string | null, now: number = Date.now()): string | null {
  if (!resetTime) return null;
  const target = new Date(resetTime);
  const targetMs = target.getTime();
  if (!Number.isFinite(targetMs)) return null;
  const diffMs = targetMs - now;
  if (diffMs <= 0) return "即将重置";
  if (window === "5h") {
    const totalMins = Math.ceil(diffMs / 60000);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return hours > 0 ? `${hours}小时${mins}分后重置` : `${mins}分钟后重置`;
  }
  const totalMins = Math.ceil(diffMs / 60000);
  const days = Math.floor(totalMins / 1440);
  const hours = Math.floor((totalMins % 1440) / 60);
  const mm = target.getMonth() + 1;
  const dd = target.getDate();
  const hh = target.getHours().toString().padStart(2, "0");
  const minStr = target.getMinutes().toString().padStart(2, "0");
  const countdown = days > 0 ? `${days}天后` : `${hours}h后`;
  return `${mm}月${dd}日 ${hh}:${minStr} (${countdown})`;
}

/** "刚刚" / "N 分钟前" / "N 小时前" / "N 天前" for a limits timestamp, or null. */
export function formatLimitsAge(updatedAt: number | null | undefined, now: number = Date.now()): string | null {
  if (typeof updatedAt !== "number" || !Number.isFinite(updatedAt)) return null;
  const diff = now - updatedAt;
  if (diff < 60000) return "刚刚";
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

/** Mask an account email for display. */
export function desensitizeEmail(email: string | null | undefined): string {
  if (!email || !email.includes("@")) return email || "—";
  const [name, domain] = email.split("@");
  if (name.length <= 3) return `${name.slice(0, 1)}***@${domain}`;
  if (name.length <= 6) return `${name.slice(0, 2)}***@${domain}`;
  return `${name.slice(0, 5)}***@${domain}`;
}

/** Human text for an account lifecycle state. */
export function stateLabel(state: string): string {
  switch (state) {
    case "active": return "正常";
    case "cooling": return "冷却中";
    case "verification-required": return "待验证";
    case "disabled": return "已禁用";
    default: return state;
  }
}

/** Dot class for the badge health light. */
export function dotStateFor(accounts: readonly AgyAccountView[]): "active" | "cooling" | "disabled" {
  const usable = accounts.filter((a) => a.active || a.state === "active");
  if (usable.length === 0) return accounts.length > 0 ? "cooling" : "disabled";
  const unhealthy = accounts.some((a) => a.state === "cooling" || a.state === "verification-required" || a.state === "disabled");
  return unhealthy ? "cooling" : "active";
}

/** Is this group upstream's Gemini group? */
function isGeminiGroup(group: QuotaGroup): boolean {
  if (/gemini/i.test(group.name)) return true;
  return group.windows.some((w) => w.bucketId.startsWith("gemini"));
}

/** Is this group upstream's third-party (Claude + GPT) group? */
function isThirdPartyGroup(group: QuotaGroup): boolean {
  if (/3p|claude|gpt|anthropic|openai/i.test(group.name)) return true;
  return group.windows.some((w) => w.bucketId.startsWith("3p"));
}

/** Small family tag for a group card. */
function groupTag(group: QuotaGroup, fallback: string, translate: boolean): string {
  if (isGeminiGroup(group)) return "Google";
  if (isThirdPartyGroup(group)) return "Claude + GPT";
  return translate ? group.name || fallback : fallback;
}

/**
 * Drain thresholds the pool rotates on, per window.
 *
 * Mirrors dsh-agy's own `SOFT_QUOTA_THRESHOLD` (0.15 on the rolling five-hour
 * window) and `WEEKLY_QUOTA_THRESHOLD` (0.01 on the weekly one) in its
 * `src/runtime/rotation.ts`: both express "how much work is left" over windows of
 * different lengths, so the two are deliberately asymmetric and must not be
 * unified. Duplicated rather than imported because this view layer runs in the
 * browser bundle while dsh-agy is a separate package — this table is the one
 * place to follow if upstream's numbers move.
 */
const WINDOW_DRAIN_THRESHOLD: Record<string, number> = { "5h": 0.15, weekly: 0.01 };

/** The windows the pool actually blocks on; `daily`/`monthly` report but never block. */
function rotationWindows(group: QuotaGroup): QuotaWindow[] {
  return group.windows.filter((w) => WINDOW_DRAIN_THRESHOLD[w.window] !== undefined);
}

/**
 * How close a window is to its own drain point, as a threshold multiple.
 *
 * Comparing raw `remainingFraction` values would rank a comfortable 44% week
 * above a comfortable 82% five-hour window and hand the badge to the week, which
 * is not what stops a request. Dividing by each window's own drain threshold asks
 * the question the pool itself asks — how much runway is left before this window
 * stops serving — so the five-hour window stays in charge until the week is
 * genuinely nearly spent.
 */
function windowPressure(window: QuotaWindow): number | null {
  if (window.remainingFraction === null) return null;
  const threshold = WINDOW_DRAIN_THRESHOLD[window.window];
  if (threshold === undefined || threshold <= 0) return null;
  return Math.max(window.remainingFraction, 0) / threshold;
}

/**
 * Pick the window that constrains the account first, for the header badge.
 *
 * Gemini first (that is what the badge has always shown), then any group that
 * reports a rotating window, so a future upstream regroup still yields a number
 * rather than a fallback count. Only the first group reporting one competes:
 * mixing groups would blend the Gemini budget with the Claude/GPT one.
 */
function pickBadgeWindow(limits: readonly QuotaGroup[] | null | undefined): QuotaWindow | null {
  if (!limits || limits.length === 0) return null;
  const gemini = limits.find(isGeminiGroup);
  const ordered = gemini ? [gemini, ...limits.filter((g) => g !== gemini)] : [...limits];
  for (const group of ordered) {
    const candidates = rotationWindows(group);
    if (candidates.length === 0) continue;
    let best: QuotaWindow | null = null;
    let bestPressure = Number.POSITIVE_INFINITY;
    for (const w of candidates) {
      const pressure = windowPressure(w);
      if (pressure === null) continue;
      if (pressure < bestPressure) {
        best = w;
        bestPressure = pressure;
      }
    }
    // Every rotating window of this group is unmeasured: hand back the first one
    // so its null fraction still falls through to the link/legacy ladder.
    return best ?? candidates[0]!;
  }
  // No rotating window anywhere: the shortest reported window is the best
  // remaining proxy, because a future upstream vocabulary must still yield a
  // number rather than a fallback count.
  for (const group of ordered) {
    const sorted = sortWindows(group.windows);
    if (sorted.length > 0) return sorted[0]!;
  }
  return null;
}

/** The badge's reading: a percentage plus the window that produced it. */
export interface BadgeQuota {
  /** 0..100. */
  percent: number;
  /** The window token that drove `percent`, or null for the model-keyed legacy rows. */
  window: string | null;
}

/**
 * The `dsh-agy-link` Google family's most constrained window.
 *
 * The link pool reports the same two windows as the grouped channel, and a spent
 * week there must drive the badge too: reading only `remainingFraction` showed a
 * healthy badge for a pool that could no longer serve a request.
 */
function pickBadgeLinkWindow(info?: FamilyQuotaInfo | null): { window: string; remainingFraction: number | null } | null {
  if (!info) return null;
  const candidates: QuotaWindow[] = [
    { bucketId: "google-5h", window: "5h", remainingFraction: info.remainingFraction ?? null, resetTime: info.resetTime ?? null }
  ];
  if (typeof info.weeklyFraction === "number") {
    candidates.push({
      bucketId: "google-weekly",
      window: "weekly",
      remainingFraction: info.weeklyFraction,
      resetTime: info.weeklyResetTime ?? null
    });
  }
  let best = candidates[0]!;
  let bestPressure = windowPressure(best) ?? Number.POSITIVE_INFINITY;
  for (const candidate of candidates.slice(1)) {
    const pressure = windowPressure(candidate) ?? Number.POSITIVE_INFINITY;
    if (pressure < bestPressure) {
      best = candidate;
      bestPressure = pressure;
    }
  }
  return { window: best.window, remainingFraction: best.remainingFraction };
}

/**
 * The badge's reading: the most constrained window of the ACTIVE account.
 *
 * Priority, highest first:
 *   1. the active account's grouped rotating windows (dsh-agy >= 0.3.0, the new channel);
 *   2. `dsh-agy-link`'s Google family 5h/weekly fractions (a second pool, still valid);
 *   3. the pre-0.3.0 per-model rows on the legacy HTTP channel (5h only).
 *
 * Reported `daily`/`monthly` windows never drive the badge: the pool does not
 * block on them, so a low monthly figure is not a reason to alarm the header.
 *
 * Returns null when nothing usable is known — the caller renders a count instead
 * of inventing 0%.
 */
export function pickBadgeQuota(
  accounts: readonly AgyAccountView[],
  linkQuotas?: AgyLinkQuotas | null
): BadgeQuota | null {
  const active = accounts.find((a) => a.active) ?? accounts[0];

  const window = pickBadgeWindow(active?.limits);
  if (window) {
    const percent = toPercent(window.remainingFraction);
    if (percent !== null) return { percent, window: window.window };
  }

  const link = pickBadgeLinkWindow(linkQuotas?.google);
  if (link) {
    const percent = toPercent(link.remainingFraction);
    if (percent !== null) return { percent, window: link.window };
  }

  const legacy = pickLegacyGemini5h(active);
  if (legacy) {
    const percent = toPercent(legacy.remainingFraction);
    if (percent !== null) return { percent, window: "5h" };
  }
  return null;
}

/**
 * The badge's percentage alone.
 *
 * Kept as the numeric entry point because it is the shape callers and tests
 * already use; use `pickBadgeQuota` when the driving window matters.
 */
export function pickBadgePercent(
  accounts: readonly AgyAccountView[],
  linkQuotas?: AgyLinkQuotas | null
): number | null {
  return pickBadgeQuota(accounts, linkQuotas)?.percent ?? null;
}

/** Core Gemini model ids, in priority order, for the legacy per-model channel. */
const LEGACY_GEMINI_IDS: readonly string[] = [
  "gemini-3.8-flash-tiered",
  "gemini-3.7-flash-tiered",
  "gemini-3.6-flash-tiered",
  "gemini-3.1-pro-low",
  "gemini-pro-agent",
  "gemini-2.5-flash",
  "gemini-2.5-pro"
];

/** First reported per-model Gemini quota row on the legacy channel, if any. */
function pickLegacyGemini5h(account?: AgyAccountView): LegacyModelQuota | null {
  const models = account?.quota?.models;
  if (!models?.length) return null;
  for (const id of LEGACY_GEMINI_IDS) {
    const found = models.find((m) => m.id === id);
    if (found && Number.isFinite(found.remainingFraction)) return found;
  }
  return null;
}

/** Build the window rows of one grouped card. */
function windowRows(windows: readonly QuotaWindow[], now: number): QuotaWindowRow[] {
  return sortWindows(windows).map((w) => {
    const percent = toPercent(w.remainingFraction);
    return {
      bucketId: w.bucketId,
      label: windowLabel(w.window),
      percent,
      color: quotaColorForWindow(w.window, percent),
      reset: formatWindowReset(w.window, w.resetTime, now)
    };
  });
}

/** The permanent `dsh-agy-link` family fallback, used when no grouped data exists. */
function linkCards(linkQuotas: AgyLinkQuotas | null | undefined, now: number): QuotaCard[] {
  if (!linkQuotas) return [];
  const families: Array<{ key: string; title: string; tag: string; info?: FamilyQuotaInfo }> = [
    { key: "google", title: "Gemini Flash & Pro", tag: "Google", info: linkQuotas.google },
    { key: "anthropic", title: "Claude 4.6 (Sonnet / Opus)", tag: "Anthropic", info: linkQuotas.anthropic },
    { key: "openai", title: "GPT-OSS (120B)", tag: "OpenAI", info: linkQuotas.openai }
  ];
  const cards: QuotaCard[] = [];
  for (const family of families) {
    const info = family.info;
    if (!info) continue;
    const windows: QuotaWindow[] = [
      { bucketId: `${family.key}-5h`, window: "5h", remainingFraction: info.remainingFraction ?? null, resetTime: info.resetTime ?? null }
    ];
    if (typeof info.weeklyFraction === "number") {
      windows.push({
        bucketId: `${family.key}-weekly`,
        window: "weekly",
        remainingFraction: info.weeklyFraction,
        resetTime: info.weeklyResetTime ?? null
      });
    }
    cards.push({ key: family.key, title: family.title, badgeTag: family.tag, windows: windowRows(windows, now) });
  }
  return cards;
}

/**
 * Build the quota cards for one account.
 *
 * The grouped windows of the new channel win whenever present; otherwise the
 * `dsh-agy-link` families; otherwise the pre-0.3.0 per-model row folded into a
 * single Gemini card. Each level is a real deployment this plugin still runs on,
 * so the ordering is a compatibility ladder, not defensive noise.
 */
export function buildQuotaCards(
  account: AgyAccountView | undefined,
  linkQuotas: AgyLinkQuotas | null | undefined,
  now: number = Date.now()
): QuotaCard[] {
  const groups = account?.limits;
  if (groups && groups.length > 0) {
    const cards: QuotaCard[] = [];
    for (const group of groups) {
      const rows = windowRows(group.windows, now);
      // A group with no usable window row would render as an empty card that
      // pushes a real one off screen; dsh-agy drops those too.
      if (rows.length === 0) continue;
      cards.push({
        key: group.name || `group-${cards.length}`,
        title: group.name || "配额分组",
        badgeTag: groupTag(group, "配额", false),
        windows: rows
      });
    }
    if (cards.length > 0) return cards;
  }

  const fromLink = linkCards(linkQuotas, now);
  if (fromLink.length > 0) return fromLink;

  const legacy = pickLegacyGemini5h(account);
  if (legacy) {
    return [{
      key: "legacy-gemini",
      title: "Gemini Flash & Pro",
      badgeTag: "Google",
      windows: windowRows([
        { bucketId: "legacy-gemini-5h", window: "5h", remainingFraction: legacy.remainingFraction, resetTime: legacy.resetTime }
      ], now)
    }];
  }
  return [];
}

/** The channel a card set came from, for the footer caption. */
export function describeSource(source: AgyQuotaSource): string {
  switch (source) {
    case "agy-rpc": return "数据: dsh-agy 分组额度 (5h / 周 / 月)";
    case "agy-link": return "数据: dsh-agy-link 额度池";
    case "legacy-http": return "数据: dsh-agy 本地账号池";
    default: return "数据: 暂无可用额度通道";
  }
}
