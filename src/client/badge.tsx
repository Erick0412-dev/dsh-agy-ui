import React, { useState, useEffect, useCallback, useRef } from "react";
import type { AgyAccountView, AgyLinkQuotas, AgyAccountSource } from "./types.js";
import { dotStateFor, pickBadgePercent, pickBadgeQuota, windowLabel } from "../quota.js";
import {
  createAgyRpc,
  loadAgyState,
  LIMITS_TTL_MS
} from "../quota-source.js";
import type { AgyRpc, ConnectionLike, LimitsProbe } from "../quota-source.js";
import { QuotaPopover } from "./popover.js";

/**
 * DSH's client `connection` service, handed over by `apply()`.
 *
 * The header-actions slot renders its component with empty props, so the service
 * cannot arrive as a prop and a module-level accessor is the only route to it.
 */
let agyUiConnection: ConnectionLike | null = null;

/** Publish the connection service to the badge (called from the plugin's apply). */
export function setAgyUiConnection(connection: ConnectionLike | null): void {
  agyUiConnection = connection;
  cachedRpcFor = undefined;
}

/** The connection service currently in use, for diagnostics. */
export function getAgyUiConnection(): ConnectionLike | null {
  return agyUiConnection;
}

/**
 * The `agy` RPC caller, rebuilt only when the connection service changes.
 *
 * `cachedRpcFor` uses `undefined` as "not built yet" so a null connection is
 * cached too, rather than rebuilding on every poll.
 */
let cachedRpc: AgyRpc | null = null;
let cachedRpcFor: ConnectionLike | null | undefined = undefined;

function currentRpc(): AgyRpc | null {
  if (cachedRpcFor !== agyUiConnection) {
    cachedRpc = createAgyRpc(agyUiConnection);
    cachedRpcFor = agyUiConnection;
  }
  return cachedRpc;
}

/**
 * Get the active account's most constrained window, as a percentage (0-100).
 *
 * Backed by `pickBadgePercent` in `../quota.ts`, which weighs the grouped 5h and
 * weekly windows of the active account against their own drain thresholds — the
 * only sources dsh-agy >= 0.3.0 offers, since its per-model `quotaInfo` has no
 * window field at all.
 *
 * @deprecated use `pickBadgeQuota` from `dsh-agy-ui`; it also reports which
 * window produced the number.
 */
export function getGemini5hPercentage(
  accounts: AgyAccountView[],
  linkQuotas?: AgyLinkQuotas | null
): number | null {
  return pickBadgePercent(accounts, linkQuotas);
}

export const AgyQuotaBadge: React.FC = () => {
  const [accounts, setAccounts] = useState<AgyAccountView[]>([]);
  const [linkQuotas, setLinkQuotas] = useState<AgyLinkQuotas | null>(null);
  const [source, setSource] = useState<AgyAccountSource>("none");
  const [loading, setLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const mountedRef = useRef(true);
  const badgeRef = useRef<HTMLButtonElement | null>(null);
  const leaveTimerRef = useRef<any>(null);
  const lastFetchTimeRef = useRef<number>(0);
  const lastProbeFailRef = useRef<number>(0);

  const fetchAccountsAndQuotas = useCallback(async (isManual: boolean = false) => {
    const now = Date.now();
    // Global Frequency Lock: in non-manual cases (tab switch / window focus),
    // enforce at least a 120-second cooldown so this NEVER repeatedly fires.
    if (!isManual && lastFetchTimeRef.current > 0 && now - lastFetchTimeRef.current < 120000 - 1000) {
      return;
    }
    lastFetchTimeRef.current = now;

    // A failed probe run writes NOTHING to dsh-agy's limits cache, so the
    // snapshot stays stale and every poll would probe upstream again. Back off
    // for one full TTL after a run that measured nothing and failed. The user's
    // explicit refresh is never gated by this.
    const probeFailedRecently =
      lastProbeFailRef.current > 0 && now - lastProbeFailRef.current < LIMITS_TTL_MS;
    const probe: LimitsProbe = isManual ? "force" : probeFailedRecently ? "off" : "auto";

    try {
      setIsUpdating(true);
      setLoading(true);
      const state = await loadAgyState({ rpc: currentRpc(), limits: probe });
      if (!mountedRef.current) return;

      // Keep the last good rows when no channel answered at all; an empty reply
      // from a channel that DID answer is a real "no accounts" and is applied.
      if (state.accountSource !== "none") {
        setAccounts(state.accounts);
        setSource(state.accountSource);
      }
      if (state.linkQuotas) {
        setLinkQuotas(state.linkQuotas);
      }
      if (state.limits) {
        lastProbeFailRef.current =
          state.limits.measured === 0 && state.limits.failed > 0 ? Date.now() : 0;
      }
      if (state.error) {
        console.warn("[dsh-agy-ui] quota refresh:", state.error);
      }
    } catch (err) {
      console.warn("[dsh-agy-ui] quota refresh failed:", err);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        // Retain the breathing pulse for 1.2s to smoothly complete the cycle.
        setTimeout(() => {
          if (mountedRef.current) {
            setIsUpdating(false);
          }
        }, 1200);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    fetchAccountsAndQuotas(false);

    // 2-minute safe background polling interval
    const timer = setInterval(() => {
      if (typeof document === "undefined" || document.visibilityState !== "hidden") {
        fetchAccountsAndQuotas(false);
      }
    }, 120000);

    // Window focus / visibility change handler (strictly throttled above)
    const onWake = () => {
      if (typeof document === "undefined" || document.visibilityState !== "hidden") {
        fetchAccountsAndQuotas(false);
      }
    };

    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);

    return () => {
      mountedRef.current = false;
      clearInterval(timer);
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
      if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    };
  }, [fetchAccountsAndQuotas]);

  const updateAnchor = () => {
    if (badgeRef.current) {
      setAnchorRect(badgeRef.current.getBoundingClientRect());
    }
  };

  const handleMouseEnterBadge = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    updateAnchor();
    setIsHovered(true);
  };

  const handleMouseLeaveBadge = () => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setIsHovered(false);
      }
    }, 250);
  };

  const handleMouseEnterPopover = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
  };

  const handleMouseLeavePopover = () => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setIsHovered(false);
      }
    }, 250);
  };

  const handleTogglePin = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    updateAnchor();
    setIsPinned(prev => !prev);
    setIsHovered(true);
  };

  const handleClose = () => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    setIsPinned(false);
    setIsHovered(false);
  };

  const accountCount = accounts.length;
  const dotState = dotStateFor(accounts);

  // The tightest window the pool rotates on, so a spent week cannot hide behind
  // a healthy five-hour bucket. The badge names the window when it is not the 5h.
  const badgeQuota = pickBadgeQuota(accounts, linkQuotas);
  const badgeWindow = badgeQuota?.window && badgeQuota.window !== "5h" ? `${windowLabel(badgeQuota.window)} ` : "";
  const displayText = badgeQuota !== null ? `AGY · ${badgeWindow}${badgeQuota.percent}%` : `AGY ✦ ${accountCount}`;

  const isOpen = isPinned || isHovered;

  return (
    <>
      <button
        ref={badgeRef}
        type="button"
        className={`agy-ui-badge ${isPinned ? "pinned" : ""}`}
        title={`Antigravity: ${accountCount} 个账号 · ${badgeQuota ? `${windowLabel(badgeQuota.window ?? "5h")}: ${badgeQuota.percent}%` : "额度未知"} · 悬停或点击查看配额详情`}
        onClick={handleTogglePin}
        onMouseEnter={handleMouseEnterBadge}
        onMouseLeave={handleMouseLeaveBadge}
      >
        <span className={`agy-ui-dot ${dotState}${isUpdating ? " updating" : ""}`} />
        <span>{displayText}</span>
      </button>

      <QuotaPopover
        open={isOpen}
        pinned={isPinned}
        onTogglePin={handleTogglePin}
        onClose={handleClose}
        onMouseEnter={handleMouseEnterPopover}
        onMouseLeave={handleMouseLeavePopover}
        anchorRect={anchorRect}
        accounts={accounts}
        linkQuotas={linkQuotas}
        source={source}
        loading={loading}
        onRefresh={() => fetchAccountsAndQuotas(true)}
      />
    </>
  );
};
