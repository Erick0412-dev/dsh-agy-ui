# dsh-agy-ui

**English** | [简体中文](./README.md)

> A non-invasive UI and user-experience companion enhancement plugin for `dsh-agy` in **DeepSeek Harness (DSH)**.

---

## 📖 Background & Philosophy

In the DeepSeek Harness ecosystem, **dsh-agy** serves as the rock-solid, ultra-fast backend directly connecting to Google's internal API (`POST /v1internal:streamGenerateContent`) with native DSH Tool execution. However, out-of-the-box it has noticeable UX shortcomings:
- **Cluttered Model List**: Contains internal ghost models (e.g. `chat_23310`, `tab_flash_lite_preview`).
- **Scattered Reasoning Efforts**: Low/Medium/High efforts are expanded into separate model dropdown entries.
- **Lack of Persistent Visibility**: Quota and multi-account state are isolated on a separate management page without header visibility.

**`dsh-agy-ui`** is designed as a pure companion enhancement plugin:
1. **Zero Intrusion to Core Communication**: Leaves request streaming and tool runtime completely to `dsh-agy`.
2. **Surface Experience Elevation**: Automatically purifies model selection, injects a sleek real-time quota badge in the conversation header, provides a glassmorphic quota inspector popover, and supports mobile drawer layouts.
3. **Coexistence with `dsh-agy-link`**: Completely isolated slot IDs, independent visual style, and zero style pollution.

---

## ✨ Features

- **Intelligent Model Purification & Priority Ordering**:
  - Automatically filters non-chat ghost models (`chat_\d+`, `tab_*`).
  - Merges scattered effort variants (`-low`, `-high`) into root models while preserving native reasoning effort selector support.
  - Fixes Tiered model display names (e.g. `Gemini 3.8 Flash`, `Gemini 3.7 Flash`, `Gemini 3.6 Flash`).
  - Strict priority order: Gemini Flash (3.8 > 3.7 > 3.6 > 3.5 > 3) → Gemini Pro (3.1 Pro) → 2.5 Series → Claude 4.6 → GPT-OSS.
- **Persistent Header Quota Badge**:
  - Injected into slot `conversation.session.header.actions` with ID `agy-ui-quota-badge`.
  - Default display directly shows Gemini 5-hour quota (e.g. `AGY · 80%`).
  - Solid health indicator dot by default; pulses smoothly *only* during background sync or manual refresh.
  - Safe 2-minute polling interval with 120-second window-focus debounce (global frequency lock) to avoid Google 429 rate limits.
- **Glassmorphic Quota Inspector Popover**:
  - Hover or click the badge to inspect dual-window limits: 5-Hour sprint cycle & 7-Day weekly cap.
  - Displays desensitized account identity and health status.
  - Provides a one-click quota refresh button and direct shortcut to `/agy` management dashboard.
  - Click-to-pin support on desktop to keep the popover open.
- **Mobile Bottom-Sheet Adaptation**:
  - Responsive design automatically switches to an iOS/Android-style bottom sheet drawer on screens $\le$ 640px.

---

## 🚀 Installation

Install into your DSH web profile:

```bash
# In your ~/.dsh/profiles/<profile> directory:
pnpm add dsh-agy-ui
```

Declare in `package.json` bundles:

```json
{
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "dsh-agy",
        "dsh-agy-ui"
      ]
    }
  }
}
```

Rebuild or restart DeepSeek Harness:

```bash
dsh restart
```

---

## 📄 License

MIT License.
