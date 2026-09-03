# PRD: dsh-agy-ui (DeepSeek Harness Antigravity UI & Experience Enhancement Plugin)

## 1. 项目背景与复盘 (Background & Context)

### 1.1 现状与生态对比
在 DeepSeek Harness (DSH) 社区中，针对 Google Antigravity (agy) 订阅接入目前存在两个主流方案：
1. **dsh-agy (github.com/chaos-03x/dsh-agy)**
   - **底层优势**：直连 Google internal API (`POST /v1internal:streamGenerateContent`)，协议极速轻量；工具调用走 DSH 原生 Tool 执行规范，工具卡片渲染规范，无注入风险。
   - **体验硬伤**：
     - 模型列表杂乱：包含非对话的 internal 幽灵模型（如 `chat_23310`, `chat_20706`, `tab_flash_lite_preview`）；
     - 模型分裂：同一种模型的不同思考档位被展开为独立条目（`gemini-3.6-flash-low` / `-medium` / `-high`），导致下拉菜单极长；
     - 缺乏即时感知：配额与多账号状态仅存在于孤立的 `/agy` 独立管理页面，缺乏类似桌面客户端顶栏常驻的配额指示器与状态徽章；
     - PR #23 问题：`gemini-3.8-flash-tiered` 在官方原版中缺乏 reasoning effort 档位识别与动态友好名格式化。
2. **dsh-agy-link (github.com/amlyczz/dsh-agy-link)**
   - **视觉优势**：具备顶栏 `AGY (N)` 状态徽章、悬浮配额弹窗以及折叠得较整洁的模型列表。
   - **底层硬伤**：依赖在宿主机后台衍生 `agy` 本地 CLI，通过 stdio 截获事件模拟合成 `run_code` / `agy_tool`，容易读取宿主机全局配置（如 `~/.gemini/config/mcp_config.json`）误调宿主 MCP（如 `everos-memory`），导致高频调用失败并引发天气/时间等灾难级模型幻觉。

### 1.2 项目定位
**dsh-agy-ui** 是一个**专为 dsh-agy 设计的独立非侵入式 UI & 体验伴生增强插件 (Companion Plugin)**。
- 坚持**零侵入底层通信**：底层完全交由 dsh-agy 负责，不碰任何网络请求与 Tool 运行流；
- 专注**表层极致体验**：负责模型菜单智能净化重构、顶栏实时配额徽章注入、轻量化配额透视弹窗；
- **与 dsh-agy-link 完全共存隔离**：采用独立插槽 ID、独立视觉设计与本地专属 API 链路，互不污染。

---

## 2. 核心开发需求 (Functional Requirements)

### 需求一：模型列表智能净化与档位重构 (Host 端 Adapter 拦截)
1. **Cordis 服务无侵入拦截**：
   - 依赖 Cordis llm 服务，在插件启动阶段代理/包装 agy Provider 的 LlmAdapter（拦截 listModels 与 resolveModel）。
2. **黑名单过滤 (Filtering)**：
   - 过滤所有非通用对话的 internal/预览幽灵模型：
     - 正则匹配：`^chat_\d+$`（如 `chat_23310`, `chat_20706`）
     - 匹配前缀/关键词：`^tab_`（如 `tab_flash_lite_preview`, `tab_jump_flash_lite_preview`）
3. **推理档位智能折叠 (Effort Folding)**：
   - 将散落的 `-low`, `-medium`, `-high`, `-extra-low` 变体折叠合并至根模型；
   - 折叠后在模型元数据中保留并暴露标准的 `thinkingEfforts: ['low', 'medium', 'high']`，让 DSH 前端原生唤起 Reasoning Effort 选择器。
4. **原生解决 PR #23 Tiered 模型痛点**：
   - 动态识别新出的 Tiered 模型（包括但不限于 `gemini-3.8-flash-tiered`, `gemini-3.7-flash-tiered`, `gemini-3.6-flash-tiered`）；
   - 无论上游是否已合入 PR #23，本插件均强制保证：
     - 自动赋予完整的 `thinkingEfforts` 配置；
     - 格式化展示名称（DisplayName），将裸 ID 转换为优雅的品牌名称（例如：`Gemini 3.8 Flash (Thinking)`、`Gemini 3.6 Flash (Thinking)`）。
5. **别名与向后兼容路由**：
   - 当用户在旧会话中选择带有 `-low` / `-high` 等旧 ID 时，在 resolveModel 环节无缝映射到主模型 + 对应 effort，避免旧会话报错。

---

### 需求二：顶栏实时配额徽章 (Client 端 Slot 注入)
1. **前端插槽安全注入**：
   - 声明 DSH 客户端插件规范：
     ```json
     "dsh": {
       "client": {
         "inject": ["slots"],
         "platform": "web"
       }
     }
     ```
   - 注入插槽：`conversation.session.header.actions`；
   - 属性隔离：
     - id: `"agy-ui-quota-badge"`（**严禁**使用 `agy-link-status`）
     - order: `8` ~ `9`
2. **视觉标识体系 (Distinct Visual Identity)**：
   - 摒弃 dsh-agy-link 的渐变旋转球环；
   - 采用精致现代的 **Antigravity 极简几何星座/粒子标（或 ✦ 字符指示）**；
   - 徽章内容形态：
     - `AGY ✦ {活跃账号数}`，带健康指示呼吸点（绿色=正常健康，黄色=冷却/限流，灰色=不可用）；
     - 悬停/紧凑模式下可展示最低核心模型的剩余百分比（例如 `AGY · 51%`）。
3. **数据源通信**：
   - 客户端组件周期性向本地 dsh-agy 已开放的无鉴权 HTTP API 拉取数据：
     - `GET /agy/api/accounts`
   - 具备 30s~60s 轮询与窗口聚焦自动刷新机制，以及防抖与网络失败平滑降级处理。

---

### 需求三：轻量化配额透视弹窗 (Popover / Modal)
点击顶栏徽章后唤起轻量毛玻璃浮层：
1. **多账号总览**：
   - 显示当前激活账号的脱敏邮箱（如 `user***@example.com`）、所属项目 ID（如 `example-project`）；
   - 显示账号当前健康状态（Active / Cooling / Rate-Limited）；
2. **核心模型配额条**：
   - 分组展示最关心的主力模型配额：
     - Gemini Pro (3.1 Pro)
     - Gemini Flash (3.8 Flash / 3.6 Flash)
     - Claude 4.6 (Sonnet / Opus)
     - GPT-OSS
   - 精确展示剩余百分比进度条与重置倒计时（例如：`Resets in 2h 45m`）；
3. **快捷入口**：
   - 提供直达完整后台 `/agy` 路由的跳转按钮，方便用户进行登录、导入凭据、设备指纹刷新等重型操作。

---

## 4. 技术约束与非功能性要求 (Constraints & Guidelines)

1. **零冲突保证 (Conflict-Free)**：
   - 系统环境可能同时存在 dsh-agy 与 dsh-agy-link。
   - 本插件导出的 Client Bundle ID、CSS Class 前缀（全部使用 `agy-ui-*`）、插槽 ID 必须保持完全独立，不能引起全局样式污染或 DOM 冲突。
2. **零循环与异常防御**：
   - listModels 拦截必须使用幂等缓存或 Proxy 守卫，避免递归拦截导致 Call Stack Overflow。
   - 当 dsh-agy 尚未启动或接口报错时，拦截器必须平滑降级（Graceful Degradation），直接放行原始列表，严禁阻塞 DSH 核心加载。
3. **构建与工程标准**：
   - 语言：TypeScript + React (JSX)；
   - 构建工具：推荐使用 tsdown 进行打包，产出遵循 DSH 标准规范：
     - `dist/index.js` (Cordis Host 插件入口)
     - `dist/client.js` (DSH Client Bundle 入口，包含 `window.__ModuleLoader__.load`)
     - `package.json` 需配置规范的 peerDependencies 及 `"dsh": { "client": { ... } }`。

---

## 5. 验收标准 (Acceptance Criteria)

| 编号 | 模块 | 验收标准 | 验证手段 |
| :--- | :--- | :--- | :--- |
| **AC-01** | 模型列表净化 | DSH 聊天界面的模型选择器中，**彻底消失** chat_23310、chat_20706、tab_flash_lite_preview 等幽灵模型。 | 打开 DSH 对话页面检查模型下拉框。 |
| **AC-02** | 推理档位折叠 | gemini-3.6-flash-low 等散落模型被折叠至主模型，选中该模型后，UI 正常渲染 **Low / Medium / High** 的思考程度切换控件。 | 选择 Gemini 模型并观察 UI 是否呈现思考档位选择。 |
| **AC-03** | PR #23 修复 | gemini-3.8-flash-tiered 显示为规范的友好名称（如 Gemini 3.8 Flash (Thinking)），且自带思考档位控制器。 | 在下拉框中选择 3.8 Flash 并验证发送。 |
| **AC-04** | 顶栏徽章显示 | 对话顶栏成功呈现 `AGY ✦ 1` 状态徽章，视觉图标与 dsh-agy-link 明显不同。 | 观察 DSH 顶部 Header 操作区。 |
| **AC-05** | 配额透视弹窗 | 点击徽章可正常弹出弹窗，正确渲染当前账号的配额百分比与重置时间，无控制台报错。 | 点击徽章并核对数据是否与 `/agy/api/accounts` 一致。 |
| **AC-06** | 兼容共存 | 当与 dsh-agy-link 同时安装在 dsh-profile-web 时，两者徽章独立存在，点击互不影响，且 DSH 服务重启平稳。 | 检查重启启动日志与界面。 |

---

## 6. 参考项目与代码指引 (Reference Materials)

1. **dsh-agy 本地源码参考**：
   - 本地代码路径：`~/.dsh/profiles/web/node_modules/dsh-agy/`
   - PR #23 详情：`https://github.com/chaos-03x/dsh-agy/pull/23`
   - HTTP 接口参考：`GET http://127.0.0.1:3080/agy/api/accounts`
2. **dsh-agy-link 客户端参考**：
   - 提取学习其 Client 插槽注入写法：
     - 查看 `~/.dsh/profiles/web/node_modules/dsh-agy-link/dist/client.js`
     - 注意其 `ctx.slots.inject('conversation.session.header.actions', ...)` 语法与 React Portal 使用方式。
3. **DSH 官方 Client 插件规范**：
   - 必须通过 `window.__ModuleLoader__.load({ id: 'dsh-agy-ui', factory: (require) => ... })` 注册。
