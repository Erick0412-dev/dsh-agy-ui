import React, { useState, useEffect, useCallback, useRef } from "react";
import type { AgyAccount, AgyAccountsResponse, AgyLinkQuotas } from "./types.js";
import { QuotaPopover } from "./popover.js";

/**
 * Get specifically Gemini's 5-Hour limit percentage (0-100).
 * Strictly ignores weekly quota to avoid confusion.
 */
export function getGemini5hPercentage(accounts: AgyAccount[], linkQuotas?: AgyLinkQuotas | null): number | null {
  // 1. First priority: official Google family 5-hour limit remainingFraction
  if (typeof linkQuotas?.google?.remainingFraction === "number" && Number.isFinite(linkQuotas.google.remainingFraction)) {
    return Math.round(linkQuotas.google.remainingFraction * 100);
  }

  // 2. Second priority: Active account's Gemini models 5h remainingFraction
  const activeAccount = accounts.find(a => a.active) || accounts[0];
  if (activeAccount?.quota?.models?.length) {
    const geminiCoreIds = [
      "gemini-3.8-flash-tiered",
      "gemini-3.7-flash-tiered",
      "gemini-3.6-flash-tiered",
      "gemini-3.1-pro-low",
      "gemini-pro-agent",
      "gemini-2.5-flash",
      "gemini-2.5-pro"
    ];

    for (const id of geminiCoreIds) {
      const m = activeAccount.quota.models.find(item => item.id === id);
      if (typeof m?.remainingFraction === "number" && Number.isFinite(m.remainingFraction)) {
        return Math.round(m.remainingFraction * 100);
      }
    }
  }

  return null;
}

export const AgyQuotaBadge: React.FC = () => {
  const [accounts, setAccounts] = useState<AgyAccount[]>([]);
  const [linkQuotas, setLinkQuotas] = useState<AgyLinkQuotas | null>(null);
  const [loading, setLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const mountedRef = useRef(true);
  const badgeRef = useRef<HTMLButtonElement | null>(null);
  const leaveTimerRef = useRef<any>(null);
  const lastFetchTimeRef = useRef<number>(0);

  const fetchAccountsAndQuotas = useCallback(async (isManual: boolean = false) => {
    const now = Date.now();
    // Global Frequency Lock: In non-manual cases (e.g. switching tabs / window focus),
    // enforce at least a 120-second cooldown so it NEVER repeatedly fires on every tab switch!
    if (!isManual && lastFetchTimeRef.current > 0 && now - lastFetchTimeRef.current < 120000 - 1000) {
      return;
    }
    lastFetchTimeRef.current = now;

    try {
      setIsUpdating(true);
      setLoading(true);
      const [accRes, linkRes] = await Promise.all([
        fetch("/agy/api/accounts").catch(() => null),
        fetch("/plugins/agy-link/status").catch(() => null)
      ]);

      if (mountedRef.current && accRes && accRes.ok) {
        const data: AgyAccountsResponse = await accRes.json();
        if (Array.isArray(data.accounts)) {
          setAccounts(data.accounts);
        }
      }

      if (mountedRef.current && linkRes && linkRes.ok) {
        const data = await linkRes.json();
        const quotas = data.pool?.accounts?.[0]?.quotas;
        if (quotas) {
          setLinkQuotas(quotas);
        }
      }
    } catch {
      // Graceful degradation
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        // Retain breathing pulse for 1.2s to smoothly complete the pulse cycle
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

    // Window focus / visibility change handler (strictly throttled by lastFetchTimeRef)
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

  const activeAccounts = accounts.filter(a => a.active || a.state === "active");
  const hasCooling = accounts.some(a => a.state === "cooling" || a.state === "rate-limited");
  const activeCount = accounts.length;

  let dotState: "active" | "cooling" | "disabled" = "disabled";
  if (activeAccounts.length > 0) {
    dotState = hasCooling ? "cooling" : "active";
  } else if (accounts.length > 0) {
    dotState = "cooling";
  }

  // Requirement 2: Default state directly displays Gemini 5h quota!
  const gemini5h = getGemini5hPercentage(accounts, linkQuotas);
  const displayText = gemini5h !== null ? `AGY · ${gemini5h}%` : `AGY ✦ ${activeCount}`;

  const isOpen = isPinned || isHovered;

  return (
    <>
      <button
        ref={badgeRef}
        type="button"
        className={`agy-ui-badge ${isPinned ? "pinned" : ""}`}
        title={`Antigravity: ${activeCount} 个账号就绪 · Gemini 5h额度: ${gemini5h !== null ? `${gemini5h}%` : "就绪"} · 悬停或点击查看配额详情`}
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
        loading={loading}
        onRefresh={() => fetchAccountsAndQuotas(true)}
      />
    </>
  );
};
