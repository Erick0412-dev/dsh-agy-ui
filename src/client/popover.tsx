import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import type { AgyAccount, AgyModelQuota, AgyLinkQuotas } from "./types.js";

export interface QuotaPopoverProps {
  open: boolean;
  pinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  anchorRect: DOMRect | null;
  accounts: AgyAccount[];
  linkQuotas: AgyLinkQuotas | null;
  loading: boolean;
  onRefresh: () => Promise<void>;
}

export function desensitizeEmail(email: string): string {
  if (!email || !email.includes("@")) return email || "—";
  const [name, domain] = email.split("@");
  if (name.length <= 3) return `${name.slice(0, 1)}***@${domain}`;
  if (name.length <= 6) return `${name.slice(0, 2)}***@${domain}`;
  return `${name.slice(0, 5)}***@${domain}`;
}

export function format5hCountdown(resetTimeStr: string | null): string {
  if (!resetTimeStr) return "";
  try {
    const diffMs = new Date(resetTimeStr).getTime() - Date.now();
    if (diffMs <= 0) return "即将重置";
    const totalMins = Math.ceil(diffMs / 60000);
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hours > 0) return `${hours}小时${mins}分后重置`;
    return `${mins}分钟后重置`;
  } catch {
    return "";
  }
}

export function formatWeeklyCountdown(resetTimeStr: string | null): string {
  if (!resetTimeStr) return "";
  try {
    const target = new Date(resetTimeStr);
    const diffMs = target.getTime() - Date.now();
    if (diffMs <= 0) return "即将重置";
    const totalMins = Math.ceil(diffMs / 60000);
    const days = Math.floor(totalMins / 1440);
    const hours = Math.floor((totalMins % 1440) / 60);
    const mm = target.getMonth() + 1;
    const dd = target.getDate();
    const hh = target.getHours().toString().padStart(2, "0");
    const minStr = target.getMinutes().toString().padStart(2, "0");
    const countdown = days > 0 ? `${days}天${hours}h后` : `${hours}h后`;
    return `${mm}月${dd}日 ${hh}:${minStr} (${countdown})`;
  } catch {
    return "";
  }
}

interface GroupQuotaDisplay {
  title: string;
  badgeTag: string;
  fiveHourFraction: number;
  fiveHourReset: string | null;
  weeklyFraction?: number | null;
  weeklyReset?: string | null;
}

export function buildGroupQuotas(
  account?: AgyAccount,
  linkQuotas?: AgyLinkQuotas | null
): GroupQuotaDisplay[] {
  const models = account?.quota?.models ?? [];
  const findModel = (ids: string[]): AgyModelQuota | null => {
    for (const id of ids) {
      const m = models.find(item => item.id === id);
      if (m) return m;
    }
    return null;
  };

  // Google family (Gemini)
  const g5hModel = findModel([
    "gemini-3.8-flash-tiered",
    "gemini-3.7-flash-tiered",
    "gemini-3.6-flash-tiered",
    "gemini-3.1-pro-low"
  ]);
  const g5h = linkQuotas?.google?.remainingFraction ?? g5hModel?.remainingFraction ?? 1;
  const g5hReset = linkQuotas?.google?.resetTime ?? g5hModel?.resetTime ?? null;
  const gWeekly = linkQuotas?.google?.weeklyFraction;
  const gWeeklyReset = linkQuotas?.google?.weeklyResetTime;

  // Anthropic family (Claude)
  const c5hModel = findModel(["claude-sonnet-4-6", "claude-opus-4-6-thinking"]);
  const c5h = linkQuotas?.anthropic?.remainingFraction ?? c5hModel?.remainingFraction ?? 1;
  const c5hReset = linkQuotas?.anthropic?.resetTime ?? c5hModel?.resetTime ?? null;
  const cWeekly = linkQuotas?.anthropic?.weeklyFraction;
  const cWeeklyReset = linkQuotas?.anthropic?.weeklyResetTime;

  // OpenAI family (GPT-OSS)
  const o5hModel = findModel(["gpt-oss-120b-medium"]);
  const o5h = linkQuotas?.openai?.remainingFraction ?? o5hModel?.remainingFraction ?? 1;
  const o5hReset = linkQuotas?.openai?.resetTime ?? o5hModel?.resetTime ?? null;
  const oWeekly = linkQuotas?.openai?.weeklyFraction;
  const oWeeklyReset = linkQuotas?.openai?.weeklyResetTime;

  return [
    {
      title: "Gemini Flash & Pro",
      badgeTag: "Google",
      fiveHourFraction: g5h,
      fiveHourReset: g5hReset,
      weeklyFraction: gWeekly,
      weeklyReset: gWeeklyReset
    },
    {
      title: "Claude 4.6 (Sonnet / Opus)",
      badgeTag: "Anthropic",
      fiveHourFraction: c5h,
      fiveHourReset: c5hReset,
      weeklyFraction: cWeekly,
      weeklyReset: cWeeklyReset
    },
    {
      title: "GPT-OSS (120B)",
      badgeTag: "OpenAI",
      fiveHourFraction: o5h,
      fiveHourReset: o5hReset,
      weeklyFraction: oWeekly,
      weeklyReset: oWeeklyReset
    }
  ];
}

export const QuotaPopover: React.FC<QuotaPopoverProps> = ({
  open,
  pinned,
  onTogglePin,
  onClose,
  onMouseEnter,
  onMouseLeave,
  anchorRect,
  accounts,
  linkQuotas,
  loading,
  onRefresh
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (!open) return null;

  const handleRefreshClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (refreshing || loading) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const activeAccount = accounts.find(a => a.active) || accounts[0];
  const groupQuotas = buildGroupQuotas(activeAccount, linkQuotas);

  // Accurate positioning in desktop: precisely centered below the badge
  let stylePos: React.CSSProperties = {};
  if (!isMobile && anchorRect) {
    const popWidth = Math.min(390, window.innerWidth - 24);
    const badgeCenter = anchorRect.left + anchorRect.width / 2;
    let left = badgeCenter - popWidth / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - popWidth - 12));
    const top = Math.max(10, Math.min(anchorRect.bottom + 8, window.innerHeight - 200));

    stylePos = {
      position: "fixed",
      top: `${top}px`,
      left: `${left}px`,
      width: `${popWidth}px`,
      zIndex: 999999
    };
  }

  const popoverNode = (
    <div
      className={`agy-ui-popover-container ${isMobile ? "mobile" : "desktop"}`}
      onClick={isMobile ? onClose : undefined}
    >
      <div
        className={`agy-ui-popover ${isMobile ? "mobile" : "desktop"}`}
        style={!isMobile ? stylePos : undefined}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile handle indicator */}
        {isMobile && <div className="agy-ui-mobile-handle" />}

        {/* Header */}
        <div className="agy-ui-modal-header">
          <div className="agy-ui-modal-title">
            <span className="agy-ui-sparkle">✦</span>
            <span>Antigravity 配额状态</span>
            {pinned && !isMobile && <span className="agy-ui-pinned-tag">已固定</span>}
          </div>
          <div className="agy-ui-header-actions">
            {!isMobile && (
              <button
                type="button"
                className={`agy-ui-icon-btn ${pinned ? "active" : ""}`}
                title={pinned ? "取消固定" : "固定弹窗"}
                onClick={onTogglePin}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill={pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v8m0 0l3-3m-3 3L9 7M5 10h14a2 2 0 0 1 2 2v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2zM12 15v7" />
                </svg>
              </button>
            )}
            <button
              type="button"
              className="agy-ui-icon-btn"
              title="刷新配额状态"
              onClick={handleRefreshClick}
              disabled={refreshing || loading}
            >
              <svg
                className={refreshing || loading ? "agy-ui-spinning" : ""}
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2.5 11.5a10 10 0 0 1 17.5-4.5l1.5 2M21.5 12.5a10 10 0 0 1-17.5 4.5l-1.5-2" />
              </svg>
            </button>
            <button
              type="button"
              className="agy-ui-icon-btn"
              title="关闭"
              onClick={onClose}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="agy-ui-modal-body">
          {/* Active Account Banner */}
          {activeAccount ? (
            <div className="agy-ui-account-card">
              <div>
                <div className="agy-ui-account-email">
                  {desensitizeEmail(activeAccount.email)}
                </div>
                <div className="agy-ui-account-project">
                  项目: {activeAccount.projectId || "默认"}
                </div>
              </div>
              <div className={`agy-ui-state-pill ${activeAccount.state || "active"}`}>
                {activeAccount.state === "active"
                  ? "正常"
                  : activeAccount.state === "cooling"
                  ? "冷却中"
                  : activeAccount.state === "rate-limited"
                  ? "已限流"
                  : activeAccount.state}
              </div>
            </div>
          ) : (
            <div className="agy-ui-account-card">
              <div className="agy-ui-account-email" style={{ color: "#94a3b8" }}>
                未检测到活跃账号，请前往后台登录
              </div>
            </div>
          )}

          {/* Section Label */}
          <div className="agy-ui-section-label">主力模型额度监控</div>

          {/* Model Groups */}
          {groupQuotas.map((group, idx) => {
            const pct5h = Math.round(group.fiveHourFraction * 100);
            const color5h = pct5h > 30 ? "#10b981" : pct5h > 10 ? "#f59e0b" : "#ef4444";
            const reset5hText = format5hCountdown(group.fiveHourReset);

            const hasWeekly = typeof group.weeklyFraction === "number";
            const pctWeekly = hasWeekly ? Math.round((group.weeklyFraction ?? 1) * 100) : null;
            const colorWeekly = pctWeekly !== null && pctWeekly > 30 ? "#38bdf8" : pctWeekly !== null && pctWeekly > 10 ? "#f59e0b" : "#ef4444";
            const resetWeeklyText = hasWeekly ? formatWeeklyCountdown(group.weeklyReset ?? null) : null;

            return (
              <div key={idx} className="agy-ui-quota-card">
                <div className="agy-ui-quota-header">
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span className="agy-ui-model-name">{group.title}</span>
                    <span className="agy-ui-model-tag">{group.badgeTag}</span>
                  </div>
                </div>

                {/* 5-Hour limit row */}
                <div className="agy-ui-limit-row">
                  <div className="agy-ui-limit-header">
                    <span className="agy-ui-limit-title">5小时周期</span>
                    <span className="agy-ui-limit-percent" style={{ color: color5h }}>
                      {pct5h}%
                    </span>
                  </div>
                  <div className="agy-ui-progress-track">
                    <div
                      className="agy-ui-progress-fill"
                      style={{
                        width: `${pct5h}%`,
                        backgroundColor: color5h
                      }}
                    />
                  </div>
                  {reset5hText && (
                    <div className="agy-ui-quota-footer">
                      <span>{reset5hText}</span>
                    </div>
                  )}
                </div>

                {/* Weekly limit row (when available) */}
                {hasWeekly && pctWeekly !== null && (
                  <div className="agy-ui-limit-row" style={{ marginTop: "5px" }}>
                    <div className="agy-ui-limit-header">
                      <span className="agy-ui-limit-title">周额度 (Weekly)</span>
                      <span className="agy-ui-limit-percent" style={{ color: colorWeekly }}>
                        {pctWeekly}%
                      </span>
                    </div>
                    <div className="agy-ui-progress-track">
                      <div
                        className="agy-ui-progress-fill"
                        style={{
                          width: `${pctWeekly}%`,
                          backgroundColor: colorWeekly
                        }}
                      />
                    </div>
                    {resetWeeklyText && (
                      <div className="agy-ui-quota-footer">
                        <span>{resetWeeklyText}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="agy-ui-modal-footer">
          <span style={{ fontSize: "11px", color: "#64748b" }}>
            {linkQuotas ? "数据: 多周期额度池已同步" : "数据: dsh-agy 本地账号池"}
          </span>
          <a
            className="agy-ui-link-btn"
            href="/agy"
            target="_blank"
            rel="noopener noreferrer"
          >
            打开完整管理后台 ↗
          </a>
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined" && document.body) {
    return ReactDOM.createPortal(popoverNode, document.body);
  }
  return popoverNode;
};
