# dsh-agy-ui

[English](./README.en.md) | **简体中文**

> 专为 **DeepSeek Harness (DSH)** 中 `dsh-agy` 设计的非侵入式 UI 与交互体验伴生增强插件。

---

## 📖 项目背景与定位

在 DeepSeek Harness (DSH) 社区中，**dsh-agy** 凭借直连 Google 内部 API (`POST /v1internal:streamGenerateContent`) 以及原生 Tool 执行标准，具备轻量极速的底层优势。但在日常使用体验上存在几处痛点：
- **模型列表冗杂**：包含内部幽灵模型（如 `chat_23310`、`tab_flash_lite_preview` 等）；
- **思考档位分裂**：同款模型的 Low / Medium / High 变体被展开为多行独立模型，下拉菜单漫长；
- **缺乏实时感知**：配额与多账号状态仅孤立存在于后台管理页，顶栏缺乏直观指示。

**`dsh-agy-ui`** 是一个**专注于表层极致体验的伴生插件 (Companion Plugin)**：
1. **零侵入底层通信**：底层完全交由 `dsh-agy` 负责，不修改任何网络通信与 Tool 运行流；
2. **极致表层体验**：自动净化与排版模型菜单、在顶栏注入实时配额徽章、提供毛玻璃双周期额度浮层与手机端抽屉适配；
3. **完美共存隔离**：采用独立插槽 ID 与独立的 `agy-ui-*` 命名空间，与 `dsh-agy-link` 完全共存隔离。

---

## ✨ 核心特性

- **模型菜单智能净化与优先级排序**：
  - 彻底过滤非通用对话的内部幽灵模型（正则匹配 `^chat_\d+$`、`^tab_`）；
  - 智能折叠 `-low` / `-medium` / `-high` 等散落模型变体，并为根模型赋予标准 `thinkingEfforts`，让 DSH 原生唤起思考档位选择器；
  - 解决 PR #23 问题：自动识别 Tiered 模型并规范品牌展示名称（如 `Gemini 3.8 Flash`）；
  - 规范优先级降序排列：Gemini Flash (3.8 > 3.7 > 3.6 > 3.5 > 3) → Gemini Pro (3.1 Pro) → 2.5 系列 → Claude 4.6 → GPT-OSS。
- **顶栏实时配额徽章**：
  - 安全注入插槽 `conversation.session.header.actions`（ID: `agy-ui-quota-badge`）；
  - 默认常驻状态直接显示 Gemini 5 小时额度（如 `AGY · 80%`）；
  - 静态健康指示点常态平稳常亮，**仅在后台同步或手动刷新时触发优雅呼吸光效**；
  - 安全轮询机制：2 分钟定时轮询 + 120 秒切标签页防抖节流（全局频率锁），杜绝频繁触发 Google 429 速率限制。
- **轻量化毛玻璃配额透视弹窗 (Popover)**：
  - 悬停即时呼出，居中对齐在徽章正下方；点击即可常驻固定（Pin）；
  - 直观呈现 **5 小时周期（Sprint）** 与 **7 天周额度（Weekly Cap）** 双重进度条及倒计时；
  - 提供一键手动刷新按钮以及直达完整管理后台（`/agy`）的快捷入口。
- **手机移动端 UI 适配 (Mobile Drawer)**：
  - 响应式适配：在屏幕宽度 $\le$ 640px 时自动无缝切换为底部滑出的抽屉式卡片（Bottom Sheet）。

---

## 🚀 安装指南

在您的 DSH Profile 目录下执行安装：

```bash
# 切换至 ~/.dsh/profiles/<profile> 目录：
pnpm add dsh-agy-ui
```

在 `package.json` 的 bundles 列表中声明加载：

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

重启 DeepSeek Harness 即可生效：

```bash
dsh restart
```

---

## 📄 开源许可

[MIT License](LICENSE)
