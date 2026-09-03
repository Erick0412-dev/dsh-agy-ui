# dsh-agy-ui

<p align="center">
  <strong>Non-invasive UI & UX Companion Enhancement Plugin for <code>dsh-agy</code> in DeepSeek Harness (DSH)</strong><br/>
  Model List Purification · Header Quota Badge · Glassmorphic Dual-Bucket Popover · Mobile Drawer Adaptation
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-agy-ui"><img src="https://img.shields.io/npm/v/dsh-agy-ui?color=blue&label=npm" alt="npm version"/></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg" alt="MIT License"/></a>
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img src="https://img.shields.io/badge/DeepSeek%20Harness-Plugin-orange" alt="DSH Plugin"/></a>
  <a href="https://github.com/Erick0412-dev/dsh-agy-ui/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"/></a>
</p>

<p align="center">
  <b>🌐 Language / 语言:</b>
  <a href="./README.md">简体中文</a> ·
  <b>English</b>
</p>

---

## 💡 Why dsh-agy-ui?

In the [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) ecosystem, [dsh-agy](https://github.com/chaos-03x/dsh-agy) serves as the lightning-fast, rock-solid provider directly talking to Google's internal API (`POST /v1internal:streamGenerateContent`) with native DSH Tool execution.

However, out-of-the-box it has several noticeable usability pain points:

| Dimension | Native `dsh-agy` Experience | Enhanced with `dsh-agy-ui` |
| :--- | :--- | :--- |
| **Model Selection** | Cluttered with internal ghost models (`chat_23310`, `tab_flash_lite_preview`) | 🧹 **Auto Regex Purification**, completely filters out non-chat models |
| **Reasoning Efforts** | Low / Medium / High efforts expanded into separate dropdown rows | 🎛️ **Smart Variant Folding**, seamlessly triggers DSH native reasoning picker |
| **Tiered Model Names** | Raw IDs displayed crudely (e.g. `gemini-3.8-flash-tiered`) | ✨ **Standardized Brand Typography**, shown cleanly as `Gemini 3.8 Flash` |
| **Model Priority** | Disordered sequence, hard to spot primary models quickly | 🏆 **Strict Priority Ranking**: 3.8 Flash > 3.7 > 3.6 > Pro > Claude > GPT-OSS |
| **Quota Visibility** | Quotas hidden away on separate `/agy` dashboard | ⚡ **Persistent Header Badge**, directly showing Gemini 5-hour quota |
| **Quota Inspection** | Must navigate away from current chat to check details | 🪟 **Hover/Click Glassmorphic Popover**, inspecting 5-hour sprint & 7-day cap |
| **Mobile UX** | Desktop popovers overflow or get cut off on narrow screens | 📱 **Responsive Drawer**, automatically slides up an iOS/Android bottom sheet |

`dsh-agy-ui` is strictly architected as a **pure companion enhancement plugin**: network transport, request streaming, and tool execution remain 100% managed by `dsh-agy`.

---

## 🏛️ Architecture & Interception Flow

`dsh-agy-ui` builds on Cordis microkernel plugin architecture. It dynamically wraps the LLM adapter in-memory and injects UI components into DSH Web slots:

```text
                    ┌────────────────────────────────────────────────────────┐
                    │               DeepSeek Harness (DSH Web)               │
                    └───────────┬────────────────────────────────┬───────────┘
                                │                                │
                        (Web Slots Injection)            (Cordis Plugin Hook)
                                │                                │
                                ▼                                ▼
                    ┌────────────────────────┐      ┌─────────────────────────┐
                    │      dsh-agy-ui        │◄─────┤ Adapter Dynamic Wrapper │
                    │ (Header Badge + Popover)│      │(Purify/Fold/Brand/Sort) │
                    └───────────┬────────────┘      └────────────┬────────────┘
                                │ HTTP Status Read                │ Native Delegation
                                ▼                                ▼
                    ┌────────────────────────┐      ┌─────────────────────────┐
                    │    dsh-agy Backend     │      │   dsh-agy Core Layer    │
                    │  (/agy/api/accounts)   │      │(Direct Google API Stream│
                    └────────────────────────┘      └─────────────────────────┘
                                ▲
                                │ Read Compatibility (Optional)
                    ┌───────────┴────────────┐
                    │      dsh-agy-link      │
                    │ (/plugins/agy-link/..) │
                    └────────────────────────┘
```

---

## ✨ Features Breakdown

### 1. 🧼 Model Purification & Standardized Presentation
- **Ghost Model Exclusion**: Automatically excludes internal non-chat endpoints matching `^chat_\d+$` and `^tab_`.
- **Reasoning Variant Folding**: Collapses fragmented `-low`, `-medium`, `-high` models into their root model, injecting standard `thinkingEfforts` metadata so DSH's native reasoning dropdown activates.
- **Brand Typography**: Formats Tiered models (e.g. `gemini-3.8-flash-tiered`) into canonical titles (`Gemini 3.8 Flash`).
- **Priority Ranking**: Gemini Flash (3.8 > 3.7 > 3.6 > 3.5 > 3) → Gemini Pro (3.1 Pro) → 2.5 Series → Claude 4.6 → GPT-OSS.

### 2. ⚡ Persistent Header Quota Badge
- **Non-Invasive Slot Injection**: Mounted at `conversation.session.header.actions` with isolated ID `agy-ui-quota-badge`.
- **Direct Quota Glance**: Directly shows Gemini 5-hour quota for the active account (e.g. `AGY · 80%`).
- **Subtle Breathing Animation**: Steady indicator dot in normal operation (green = active, yellow = cooling/rate-limited, gray = unavailable); smoothly pulses for 1.2s only during background sync or manual refresh.
- **120s Global Frequency Lock**: 2-minute polling interval combined with a 120-second window-focus cooldown lock, preventing high-frequency Google 429 rate limits caused by tab switches.

### 3. 🪟 Glassmorphic Quota Inspector Popover
- **Hover & Pin Support**: Hover to display instantly, centered right below the badge. Click the badge to pin it open.
- **Dual-Bucket Quota Bars**:
  - **5-Hour Sprint Cycle**: Visual progress bar for current 5-hour rolling limit.
  - **7-Day Weekly Cap**: Automatically surfaces weekly quota limits when available.
- **Account Health & Shortcuts**: Displays masked account identifier, real-time health status, one-click refresh button, and direct shortcut to the `/agy` dashboard.

### 4. 📱 Mobile Bottom Sheet Drawer
- Responsive adaptation: On screens $\le$ 640px, the popover transforms into an iOS/Android style bottom drawer with touch-friendly dismiss and backdrop.

### 5. 🛡️ Namespace Isolation & Coexistence
- All CSS classes use the `agy-ui-*` namespace prefix, completely eliminating style bleed.
- Fully compatible with `dsh-agy-link`: safely coexists and prioritizes link's official dual-bucket quota endpoints when detected.

---

## 🚀 Installation & Setup

### Step 1: Install in your DSH Profile

In your DeepSeek Harness profile directory (e.g. `~/.dsh/profiles/<profile-name>`):

```bash
pnpm add dsh-agy-ui
```

> 💡 **Prerequisite**: Ensure that the upstream [dsh-agy](https://github.com/chaos-03x/dsh-agy) provider is installed and configured.

### Step 2: Declare in `package.json`

Add `dsh-agy-ui` to your `package.json` under `dsh.profile.bundles`:

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

### Step 3: Restart DSH

```bash
dsh restart
```

Refresh your DSH Web interface (`http://127.0.0.1:3080`) to enjoy purified models and the header quota badge!

---

## ❓ Frequently Asked Questions (FAQ)

<details>
<summary><b>Q1: Why does the badge indicator show a gray dot?</b></summary>
A gray dot indicates that no active Antigravity accounts were detected. Visit <code>http://127.0.0.1:3080/agy</code> to add an account and complete Google authentication.
</details>

<details>
<summary><b>Q2: Why doesn't the quota refresh immediately when switching tabs?</b></summary>
To protect your accounts against Google 429 Rate Limit penalties, the plugin implements a <b>120-second Global Frequency Lock</b>. Window focus and tab switches within 120 seconds are debounced. You can click the manual refresh icon in the popover at any time to force an immediate update.
</details>

<details>
<summary><b>Q3: Can I run both dsh-agy-ui and dsh-agy-link together?</b></summary>
Yes! <code>dsh-agy-ui</code> features isolated slot IDs and distinct CSS namespaces. It seamlessly coexists with <code>dsh-agy-link</code> and automatically leverages link's quota endpoints when available.
</details>

---

## 🙏 Acknowledgments

This project stands on the shoulders of giants. Sincere thanks to:

- 🌟 **[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)** (`deepseek-ai/deepseek-harness`)  
  **The Core Foundation of Everything**. DSH's elegant Cordis microkernel, extensible Web UI slots, and LLM adapter abstractions make non-invasive companion plugins possible.
- ⚡ **[dsh-agy](https://github.com/chaos-03x/dsh-agy)** by [@chaos-03x](https://github.com/chaos-03x)  
  **The Core Upstream Provider**. Connecting directly to Google's internal APIs with native tool calling and multi-account rotation, providing the reliable backend engine.
- 🎨 **[dsh-agy-link](https://github.com/amlyczz/dsh-agy-link)** by [@amlyczz](https://github.com/amlyczz)  
  **Invaluable Inspiration & Aesthetic Masterpiece**. Its gorgeous UI layout, dual-bucket quota monitoring concept (5h sprint + 7d weekly), and refined visual craft served as tremendous inspiration for this companion plugin!

---

## ⚖️ License & Compliance

- This project is licensed under the [MIT License](./LICENSE).
- All referenced upstream projects (`deepseek-harness`, `dsh-agy`, `dsh-agy-link`) are licensed under the permissive **MIT License**. This project complies with all applicable open-source license terms by integrating through public hooks, runtime wrappers, and HTTP APIs without incorporating proprietary or infringing derivative code.
- **Disclaimer**: This is an independent community open-source project and is not affiliated with, endorsed by, or sponsored by Google LLC or DeepSeek. Please use responsibly according to each service provider's terms of service.
