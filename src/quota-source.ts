/**
 * The data channel behind the quota badge.
 *
 * dsh-agy >= 0.3.0 moved its management surface from the standalone `/agy`
 * dashboard onto DSH's own RPC channel: the host registers `/api/agy` with
 * `connection.fetch.register`, and a browser client drives it with
 * `connection.rpc.call('/api', 'agy', { method, payload })`. Only
 * `/agy/oauth-callback` is still a plain HTTP route, so the old
 * `fetch('/agy/api/accounts')` is a 404.
 *
 * This module hides that migration behind one `loadAgyState()`, and keeps the
 * two older channels as fallbacks so the badge still shows numbers against a
 * pre-0.3.0 dsh-agy or a profile where dsh-agy is absent entirely:
 *
 *   1. `/api/agy` RPC           — dsh-agy >= 0.3.0, groups with 5h/weekly/monthly windows
 *   2. `GET /agy/api/accounts`  — dsh-agy < 0.3.0, per-model `quota.models`
 *   3. `GET /plugins/agy-link/status` — always tried, an independent pool
 *
 * Nothing here throws: a badge that cannot reach its data shows a count, and a
 * thrown error would blank the header instead.
 *
 * Dependency-free on purpose (no React, no DOM): it is re-exported from the Node
 * entry so the transport can be unit-tested against a fake RPC, and inlined into
 * the browser bundle by the client entry.
 */
import type { AgyAccountView, AgyLinkQuotas, QuotaGroup } from "./quota.js";

/** DSH's RPC channel and endpoint, as registered by dsh-agy's web plugin. */
export const AGY_RPC_CHANNEL = "/api";
export const AGY_RPC_ENDPOINT = "agy";

/** dsh-agy-link's status route (unchanged across the versions this plugin targets). */
export const AGY_LINK_STATUS_URL = "/plugins/agy-link/status";

/** The legacy dsh-agy dashboard route, removed in 0.3.0. */
export const LEGACY_ACCOUNTS_URL = "/agy/api/accounts";

/**
 * How long dsh-agy's `account.limits` reply stays fresh server-side.
 *
 * Mirrors `LIMITS_CACHE_TTL_MS` in dsh-agy's session. Used only to decide
 * whether asking is worth a round trip — the server skips a probe inside the
 * TTL, so asking early costs one RPC and no upstream call.
 */
export const LIMITS_TTL_MS = 10 * 60 * 1000;

/** The slice of the client `connection` service this plugin needs. */
export interface ConnectionLike {
  rpc?: {
    call(channel: string, endpoint: string, payload: unknown, signal?: AbortSignal): Promise<unknown>;
  };
}

/** One entry of the `account.limits` reply. */
export interface AgyLimitsEntry {
  index: number;
  groups: QuotaGroup[] | null;
  updatedAt: number | null;
}

/** What a limits probe did, so a forced refresh that changed nothing is visible. */
export interface AgyLimitsOutcome {
  measured: number;
  failed: number;
  skipped: number;
}

/** Which channel produced the account rows. */
export type AgyAccountSource = "agy-rpc" | "legacy-http" | "none";

/** One `agy` RPC method call. */
export interface AgyRpc {
  call(method: string, payload?: Record<string, unknown>, signal?: AbortSignal): Promise<unknown>;
}

/** The full state one refresh produces. */
export interface AgyState {
  accounts: AgyAccountView[];
  linkQuotas: AgyLinkQuotas | null;
  /** Channel the account rows came from. */
  accountSource: AgyAccountSource;
  /** Result of the limits probe, or null when none ran. */
  limits: AgyLimitsOutcome | null;
  /** First failure of this refresh, for logging only; the UI degrades silently. */
  error: string | null;
}

/** Whether to probe for the 5h/weekly windows. */
export type LimitsProbe = "force" | "auto" | "off";

/**
 * DSH wraps every RPC reply in `{ ok: true, value }` / `{ ok: false, error }`.
 *
 * An unrecognized envelope throws, exactly as dsh-agy's own client does:
 * returning the raw object would read `undefined.accounts` and render an empty
 * pool as though it were a healthy one.
 */
function unwrapRpcResult(result: unknown): unknown {
  if (result === null || typeof result !== "object") {
    throw new Error("malformed agy RPC response");
  }
  const envelope = result as { ok?: unknown; value?: unknown; error?: { message?: unknown } };
  if (envelope.ok === true) return envelope.value;
  if (envelope.ok === false) {
    const message = typeof envelope.error?.message === "string" ? envelope.error.message : "agy RPC call failed";
    throw new Error(message);
  }
  throw new Error("malformed agy RPC response");
}

/**
 * Build the `agy` RPC caller from a client `connection` service.
 *
 * Returns null when the service is absent or has no `rpc` — the caller then
 * falls back to the legacy HTTP channel instead of failing.
 */
export function createAgyRpc(connection: ConnectionLike | null | undefined): AgyRpc | null {
  const rpc = connection?.rpc;
  if (!rpc || typeof rpc.call !== "function") return null;
  return {
    async call(method, payload = {}, signal) {
      const result = await rpc.call(
        AGY_RPC_CHANNEL,
        AGY_RPC_ENDPOINT,
        { method, payload },
        signal
      );
      return unwrapRpcResult(result);
    }
  };
}

/** Read the pool quotas out of a `dsh-agy-link` status reply. */
export function readLinkQuotas(payload: unknown): AgyLinkQuotas | null {
  const pool = (payload as { pool?: { accounts?: Array<{ quotas?: AgyLinkQuotas }> } } | null)?.pool;
  const quotas = pool?.accounts?.[0]?.quotas;
  if (!quotas || typeof quotas !== "object") return null;
  return quotas;
}

/** Read the account rows out of a legacy `/agy/api/accounts` reply. */
export function readLegacyAccounts(payload: unknown): AgyAccountView[] {
  const accounts = (payload as { accounts?: unknown } | null)?.accounts;
  return Array.isArray(accounts) ? (accounts as AgyAccountView[]) : [];
}

/** `fetch`, or null outside a browser-like environment. */
function resolveFetch(fetchImpl?: typeof fetch): typeof fetch | null {
  if (fetchImpl) return fetchImpl;
  return typeof fetch === "function" ? fetch : null;
}

async function getJson(fetchImpl: typeof fetch | null, url: string, signal?: AbortSignal): Promise<unknown> {
  if (!fetchImpl) return null;
  const response = await fetchImpl(url, signal ? { signal } : undefined);
  if (!response.ok) return null;
  return await response.json();
}

/** Do the account rows already carry limits too fresh to be worth re-probing? */
export function limitsAreFresh(accounts: readonly AgyAccountView[], now: number = Date.now()): boolean {
  if (accounts.length === 0) return true;
  return accounts.every((account) => {
    if (account.limitsUpdatedAt === null || account.limitsUpdatedAt === undefined) return false;
    if (account.limits === null || account.limits === undefined) return false;
    return now - account.limitsUpdatedAt < LIMITS_TTL_MS;
  });
}

/**
 * Merge an `account.limits` reply into the account rows.
 *
 * The reply always lists EVERY account with its current cache, so an entry
 * replaces the row's limits outright rather than patching a delta.
 */
export function mergeLimits(accounts: readonly AgyAccountView[], entries: readonly AgyLimitsEntry[]): AgyAccountView[] {
  if (entries.length === 0) return [...accounts];
  const byIndex = new Map(entries.map((entry) => [entry.index, entry]));
  return accounts.map((account, position) => {
    const entry = byIndex.get(typeof account.index === "number" ? account.index : position);
    if (!entry) return account;
    return { ...account, limits: entry.groups, limitsUpdatedAt: entry.updatedAt };
  });
}

/**
 * Load everything the badge renders.
 *
 * The channels are probed independently: the account list decides where the rows
 * come from, the limits probe enriches them, and the link status is always
 * fetched because it is a different pool that can be up while dsh-agy's is not.
 *
 * `limits` is `force` for the user's explicit refresh (the same `force: true`
 * dsh-agy's own Refresh button sends, which is the only thing allowed to spend an
 * upstream call inside the TTL), `auto` for polling, and `off` for the back-off
 * after a failed probe run.
 */
export async function loadAgyState(options: {
  rpc: AgyRpc | null;
  limits?: LimitsProbe;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
}): Promise<AgyState> {
  const fetchImpl = resolveFetch(options.fetchImpl);
  const probe: LimitsProbe = options.limits ?? "auto";
  let error: string | null = null;

  const linkPromise = getJson(fetchImpl, AGY_LINK_STATUS_URL, options.signal).catch(() => null);

  let accounts: AgyAccountView[] = [];
  let accountSource: AgyAccountSource = "none";

  if (options.rpc) {
    try {
      const reply = (await options.rpc.call("account.list", {}, options.signal)) as { accounts?: AgyAccountView[] } | null;
      accounts = Array.isArray(reply?.accounts) ? reply!.accounts! : [];
      accountSource = "agy-rpc";
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  if (accountSource === "none") {
    try {
      const payload = await getJson(fetchImpl, LEGACY_ACCOUNTS_URL, options.signal);
      const legacy = readLegacyAccounts(payload);
      if (legacy.length > 0) {
        accounts = legacy;
        accountSource = "legacy-http";
      }
    } catch (err) {
      if (!error) error = err instanceof Error ? err.message : String(err);
    }
  }

  let limits: AgyLimitsOutcome | null = null;
  const shouldProbe =
    probe === "force" || (probe === "auto" && !limitsAreFresh(accounts));
  if (options.rpc && accountSource === "agy-rpc" && shouldProbe) {
    try {
      const reply = (await options.rpc.call(
        "account.limits",
        probe === "force" ? { force: true } : {},
        options.signal
      )) as { limits?: AgyLimitsEntry[]; measured?: number; failed?: number; skipped?: number } | null;
      const entries = Array.isArray(reply?.limits) ? reply!.limits! : [];
      accounts = mergeLimits(accounts, entries);
      limits = {
        measured: Number(reply?.measured ?? 0),
        failed: Number(reply?.failed ?? 0),
        skipped: Number(reply?.skipped ?? 0)
      };
    } catch (err) {
      if (!error) error = err instanceof Error ? err.message : String(err);
    }
  }

  const linkPayload = await linkPromise;
  return { accounts, linkQuotas: readLinkQuotas(linkPayload), accountSource, limits, error };
}
