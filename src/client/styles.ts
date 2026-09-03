export const CSS_TEXT = `
.agy-ui-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(30, 41, 59, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 9999px;
  padding: 3px 10px;
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.5;
  color: #f1f5f9;
  cursor: pointer;
  user-select: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  font-family: inherit;
}

.agy-ui-badge:hover,
.agy-ui-badge.pinned {
  background: rgba(51, 65, 85, 0.95);
  border-color: rgba(255, 255, 255, 0.35);
  transform: translateY(-1px);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.35);
}

.agy-ui-badge.pinned {
  border-color: #a855f7;
  box-shadow: 0 0 0 1px #a855f7, 0 3px 10px rgba(0, 0, 0, 0.35);
}

.agy-ui-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
  transition: background-color 0.3s;
}

.agy-ui-dot.active {
  background-color: #10b981;
  box-shadow: 0 0 5px rgba(16, 185, 129, 0.4);
}

.agy-ui-dot.cooling {
  background-color: #f59e0b;
  box-shadow: 0 0 5px rgba(245, 158, 11, 0.4);
}

.agy-ui-dot.disabled {
  background-color: #64748b;
}

/* Breathing pulse effect ONLY during updating! Steady/non-pulsing by default */
.agy-ui-dot.updating {
  animation: agy-ui-pulse 1.2s ease-in-out infinite;
}

.agy-ui-dot.active.updating {
  box-shadow: 0 0 10px #10b981;
}

.agy-ui-dot.cooling.updating {
  box-shadow: 0 0 10px #f59e0b;
}

@keyframes agy-ui-pulse {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.35;
    transform: scale(0.7);
  }
}

.agy-ui-sparkle {
  color: #a855f7;
  font-size: 13px;
  line-height: 1;
}

/* Popover Container (Desktop: transparent layer; Mobile: backdrop overlay) */
.agy-ui-popover-container.desktop {
  position: static;
}

.agy-ui-popover-container.mobile {
  position: fixed;
  inset: 0;
  z-index: 999999;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  animation: agy-ui-fade-in 0.2s ease-out;
}

/* Floating Popover Card */
.agy-ui-popover {
  background: rgba(15, 23, 42, 0.96);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow: 0 20px 45px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.05);
  color: #f8fafc;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  box-sizing: border-box;
}

.agy-ui-popover.desktop {
  border-radius: 14px;
  animation: agy-ui-popover-in 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.agy-ui-popover.mobile {
  width: 100%;
  max-height: 82vh;
  border-radius: 20px 20px 0 0;
  border-bottom: none;
  animation: agy-ui-bottom-sheet-in 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.agy-ui-mobile-handle {
  width: 36px;
  height: 4px;
  background: rgba(255, 255, 255, 0.25);
  border-radius: 9999px;
  margin: 8px auto 2px auto;
}

@keyframes agy-ui-popover-in {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes agy-ui-bottom-sheet-in {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

@keyframes agy-ui-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.agy-ui-modal-header {
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: rgba(255, 255, 255, 0.02);
}

.agy-ui-modal-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
  color: #f8fafc;
}

.agy-ui-pinned-tag {
  font-size: 10px;
  font-weight: 500;
  color: #c084fc;
  background: rgba(168, 85, 247, 0.15);
  border: 1px solid rgba(168, 85, 247, 0.3);
  padding: 1px 6px;
  border-radius: 9999px;
  margin-left: 2px;
}

.agy-ui-header-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.agy-ui-icon-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.agy-ui-icon-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: #f8fafc;
}

.agy-ui-icon-btn.active {
  color: #c084fc;
  background: rgba(168, 85, 247, 0.18);
}

.agy-ui-icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.agy-ui-spinning {
  animation: agy-ui-spin 1s linear infinite;
}

@keyframes agy-ui-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.agy-ui-modal-body {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 11px;
  max-height: 70vh;
  overflow-y: auto;
}

.agy-ui-account-card {
  background: rgba(30, 41, 59, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 9px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.agy-ui-account-email {
  font-size: 12.5px;
  font-weight: 500;
  color: #f1f5f9;
}

.agy-ui-account-project {
  font-size: 11px;
  color: #94a3b8;
  margin-top: 2px;
}

.agy-ui-state-pill {
  font-size: 10.5px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 9999px;
  text-transform: capitalize;
}

.agy-ui-state-pill.active {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.agy-ui-state-pill.cooling {
  background: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.agy-ui-section-label {
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.agy-ui-quota-card {
  background: rgba(30, 41, 59, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.agy-ui-quota-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2px;
}

.agy-ui-model-name {
  font-size: 12px;
  font-weight: 600;
  color: #e2e8f0;
}

.agy-ui-model-tag {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  color: #94a3b8;
  font-weight: 500;
}

.agy-ui-limit-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.agy-ui-limit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
}

.agy-ui-limit-title {
  color: #cbd5e1;
  font-size: 10.5px;
}

.agy-ui-limit-percent {
  font-weight: 600;
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}

.agy-ui-progress-track {
  width: 100%;
  height: 5px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 9999px;
  overflow: hidden;
}

.agy-ui-progress-fill {
  height: 100%;
  border-radius: 9999px;
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.agy-ui-quota-footer {
  display: flex;
  justify-content: flex-end;
  font-size: 10px;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
}

.agy-ui-modal-footer {
  padding: 10px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.02);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.agy-ui-link-btn {
  color: #38bdf8;
  text-decoration: none;
  font-size: 11.5px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  transition: color 0.15s;
  background: none;
  border: none;
  padding: 0;
}

.agy-ui-link-btn:hover {
  color: #7dd3fc;
  text-decoration: underline;
}

/* Mobile Responsiveness */
@media (max-width: 640px) {
  .agy-ui-badge {
    padding: 2px 7px;
    font-size: 10.5px;
    gap: 4px;
  }
  .agy-ui-modal-body {
    padding: 12px 14px;
    gap: 10px;
  }
}
`;

export function injectAgyUiStyles() {
  if (typeof document === "undefined") return;
  const existing = document.getElementById("agy-ui-styles");
  if (existing) {
    existing.textContent = CSS_TEXT;
    return;
  }
  const style = document.createElement("style");
  style.id = "agy-ui-styles";
  style.textContent = CSS_TEXT;
  document.head.appendChild(style);
}
