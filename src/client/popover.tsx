import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import type { AgyAccountView, AgyAccountSource, AgyLinkQuotas, QuotaCard } from "./types.js";
import {
  buildQuotaCards,
  desensitizeEmail,
  formatLimitsAge,
  formatWindowReset,
  stateLabel,
  describeSource
} from "../quota.js";

export interface QuotaPopoverProps {
  open: boolean;
  pinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  anchorRect: DOMRect | null;
  accounts: AgyAccountView[];
  linkQuotas: AgyLinkQuotas | null;
  /** Which channel produced `accounts`, so the footer can name it honestly. */
  source: AgyAccountSource;
  loading: boolean;
  onRefresh: () => Promise<void>;
}

/**
 * @deprecated kept for compatibility; windows are formatted by
 * `formatWindowReset` from `dsh-agy-ui`, which takes the window token so a
 * weekly, monthly and daily bucket all read correctly rather than just 5h.
 */
export function format5hCountdown(resetTimeStr: string | null): string {
  return formatWindowReset("5h", resetTimeStr) ?? "";
}

/** @deprecated see `format5hCountdown`. */
export function formatWeeklyCountdown(resetTimeStr: string | null): string {
  return formatWindowReset("weekly", resetTimeStr) ?? "";
}

/** Render one window row of a quota card. */
function renderWindow(
  window: QuotaCard["windows"][number],
  index: number
): React.ReactElement {
  return (
    <div
      key={window.bucketId}
      className="agy-ui-limit-row"
      style={index > 0 ? { marginTop: "5px" } : undefined}
    >
      <div className="agy-ui-limit-header">
        <span className="agy-ui-limit-title">{window.label}</span>
        <span className="agy-ui-limit-percent" style={{ color: window.color }}>
          {window.percent === null ? "—" : `${window.percent}%`}
        </span>
      </div>
      <div className="agy-ui-progress-track">
        <div
          className="agy-ui-progress-fill"
          style={{
            width: `${window.percent ?? 0}%`,
            backgroundColor: window.color
          }}
        />
      </div>
      {window.reset && (
        <div className="agy-ui-quota-footer">
          <span>{window.reset}</span>
        </div>
      )}
      {window.percent === null && (
        <div className="agy-ui-window-note">上游未返回该窗口的剩余比例</div>
      )}
    </div>
  );
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
  source,
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
  // One renderer for every group upstream reports: "Gemini Models" and
  // "Claude and GPT models" today, whatever it grows into tomorrow. The old
  // hardcoded family split could not express that (3p-* covers Claude AND GPT)
  // and had no concept of a monthly window at all.
  const cards = buildQuotaCards(activeAccount, linkQuotas);
  const limitsAge = formatLimitsAge(activeAccount?.limitsUpdatedAt ?? null);
  const usesRpc = source === "agy-rpc";

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
                {stateLabel(activeAccount.state || "active")}
              </div>
            </div>
          ) : (
            <div className="agy-ui-account-card">
              <div className="agy-ui-account-email" style={{ color: "#94a3b8" }}>
                未检测到活跃账号，请前往设置页登录
              </div>
            </div>
          )}

          {/* An appeal link is the one thing a parked account needs, and dsh-agy
              reports it only while the challenge is live. */}
          {activeAccount?.verificationUrl && (
            <div className="agy-ui-verify-note">
              <span>该账号被要求验证身份</span>
              <a
                className="agy-ui-link-btn"
                href={activeAccount.verificationUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                打开申诉链接 ↗
              </a>
            </div>
          )}

          {/* Section Label */}
          <div className="agy-ui-section-label">额度监控 (5小时 / 日 / 周 / 月)</div>

          {/* Quota Groups */}
          {cards.map(card => (
            <div key={card.key} className="agy-ui-quota-card">
              <div className="agy-ui-quota-header">
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span className="agy-ui-model-name">{card.title}</span>
                  <span className="agy-ui-model-tag">{card.badgeTag}</span>
                </div>
              </div>
              {card.windows.map(renderWindow)}
            </div>
          ))}

          {cards.length === 0 && (
            <div className="agy-ui-window-note" style={{ padding: "8px 0" }}>
              暂无额度数据{usesRpc ? "，点击右上角刷新重新测量" : ""}
            </div>
          )}

          {limitsAge && <div className="agy-ui-limit-age">额度测量于 {limitsAge}</div>}
        </div>

        {/* Footer */}
        <div className="agy-ui-modal-footer">
          <span style={{ fontSize: "11px", color: "#64748b" }}>
            {describeSource(source !== "none" ? source : linkQuotas ? "agy-link" : "none")}
          </span>
          {/* The /agy dashboard was replaced by an inline Settings section in
              dsh-agy 0.3.0, so that link only exists on the legacy channel. */}
          {source === "legacy-http" && (
            <a
              className="agy-ui-link-btn"
              href="/agy"
              target="_blank"
              rel="noopener noreferrer"
            >
              打开完整管理后台 ↗
            </a>
          )}
          {usesRpc && (
            <span style={{ fontSize: "11px", color: "#64748b" }}>
              管理入口: 设置 → Antigravity
            </span>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined" && document.body) {
    return ReactDOM.createPortal(popoverNode, document.body);
  }
  return popoverNode;
};
