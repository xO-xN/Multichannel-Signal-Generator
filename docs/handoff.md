# Multichannel Signal Generator — Handoff（开发交接笔记）

面向继续开发此工程的开发者与 AI 代理：记录结构约定、边界与已知决策。

## 分层约定

- `lib/` 是可复用核心，**不得包含作品特定逻辑**。改动它意味着所有继承该模板的工程都受影响。
- **例外（本工程）**：`lib/audio-engine.js` 承载本工程的作品语义（16 路 toneTest 的频率/增益规则、组与实例管理、启动序列）——它是纯逻辑模块（可单测，无 HTTP/socket 依赖），见决策记录。
- `server.js` 做编排（两个 HTTP server、路由、生命周期），并承载 API 校验（channel 1..16、value 0..1）——本工程没有独立的路由层，校验就在 server.js 的 handler 里。
- **本工程无 sockets**（无 Socket.IO）、**无 p5**、**无 performer UI**（performer 端口只有 `/__pnds/health` + 无 UI stub 页）；**仅 internal 音频模式**。
- 浏览器端只有一个单页 `public/index.html`（无独立 shared.js / performer.js / monitor.js / style.css）——例外是被浏览器加载的桥模块与文案表：`lib/theme-follow.js` / `lib/locale-follow.js`（主题 / 语言跟随参考实现，UMD 形态：浏览器全局 `PNDS_THEME` / `PNDS_LOCALE` 自接线 + Node `module.exports` 供测试），经 monitor 端口的 `GET /__pnds/theme-follow.js` / `GET /__pnds/locale-follow.js` 提供（与 health 同属 App 契约命名空间）；`public/copy.js`（双语文案表，浏览器全局 `PNDS_COPY`），随 public/ 静态服务。

## 端口约定

端口只在 `manifest.json` 定义（`scoreServer.performerPort` / `monitorPort`）。`server.js` 从 manifest 读取，可用 `PNDS_PERFORMER_PORT` / `PNDS_MONITOR_PORT` 覆盖（集成测试用随机端口就是靠它）。创作者改端口只需改 manifest.json。

## PNDS 契约要点（必须遵守）

- `scoreServer.entry` 指向 `server.js`，路径必须在工程根内；禁止绝对路径与 `../`。
- manifest 的 `audio` 块声明 `defaultMode: "internal"`、`supportedModes: ["internal"]`、`outputChannels: 16`、`scsynth`（blockSize 64 / audioBusChannels 128）与 `synthdefs`（编译产物路径，必须存在）。`sampleRate` 已从 schema 的活跃表面移除（运行契约 §7.2）——manifest 里残留的值读取后忽略，启动采样率由 App 全局采样率偏好决定（未设置时 48000）。
- health ready 的前置条件：两个 HTTP server 都监听成功 **且** 音频引擎确认 16 个实例存在（运行契约 §8：所有 master/instance 确认后才 ready）。没有 scsynth 时 health 停在 starting/error，但 endpoint 照常响应。
- 退出时释放全部资源：`/g_freeAll` 组、OSC UDP socket、两个 HTTP server——见 `server.js` 的 `shutdown()`（SIGINT/SIGTERM，退出码 0）。
- 唯一生产依赖 `qrcode ^1.5.4`（仅 monitor `/qr` 使用）。spec §2 的 preflight 要求生产依赖已安装 → 发布包必须预装 node_modules（见决策记录）。

## 决策记录

- **2026-10-04 仪器面板 UI（v1.2.1）**：`public/index.html` 仍是单页、内联样式和 DOM 脚本。通道阵列与主推子合并为一块面板，数字使用系统等宽字体；表面和分隔线从现有主题变量用 `color-mix` 推导，不新增外部字体或运行依赖。页面在加载主题桥前设置 `PNDS_THEME_OPTIONS.onTheme`，把主题名写入 `data-utility-theme`，供 Brutal 的直角、硬投影和零过渡规则使用；颜色仍由参考桥映射。新文案仍在 `public/copy.js` 的双语表。通道数量与 ON/OFF 根据本页开关选择更新，不代表实测电平；语言切换保留开关选择，不发送额外音频命令。二维码使用原生 `details/summary` 收起，不改变目标。推子仍是原生 range，桌面旋转显示、手机水平显示，`aria-valuetext` 随读数和语言更新。页面回归测试覆盖默认无发声命令、通道 1/16 的 POST、开启计数、语言切换保留状态及主音量端点。App 的 `src-tauri/resources/utilities/` 是拉取产物；本地预览可同步 `public/index.html` / `public/copy.js` / 版本元数据，正式随 App 分发仍需发布新 `.pnds` 并更新 App 注册表。

- **2026-08-15 重命名同步（multichannel-tone-test → Multichannel Signal Generator）**：文件夹从 `multichannel-tone-test` / "Multichannel Tone Test" 重命名为 "Multichannel Signal Generator"，所有内部标识符同步（package.json name、manifest id/name、synthdef 产物与源文件名、server/页面字符串、测试断言），遵循 LND 命名约定（文件夹含空格 ↔ 中划线 id/repo：`Multichannel Signal Generator` ↔ `multichannel-signal-generator` / `Multichannel-Signal-Generator`）。PNDS-App 仓库中的旧 `examples/multichannel-tone-test` 路径已移除，工程成为独立 GitHub 仓库（同 LND）。
- **Monitor QR（仿 LND 模式）**：qrcode 依赖、`lib/qr.js`（node 原生 handler，无 Express）、`lib/network.js`（resolveHostLanIp、PNDS_HOST_IP）、monitor server 的 `/qr` 路由（performer 端口 404）、fader 页底部 QR 行、集成测试断言 PNG magic（`89 50 4E 47`）。这是第一个生产依赖，因此工程从此**携带 node_modules**（spec §2：App preflight 要求生产依赖已安装；发布包由 package.yml 预装；本地仓库仍以 .gitignore 排除 node_modules，首次使用 npm install），App requirements 文档中针对本示例的 "zero npm production deps" 措辞已删除。
- **2026-08-15 QR 指向 monitor 页 + 描述更新**：QR 目标从 performer 页（:6868，无 UI stub）改为 **monitor 页（:6869）**——现场人员扫码直接打开 16 路 fader 控制台，副标题同步为 "Scan to open the monitor page"；`package.json` / `manifest.json` 的 description 与 README/creator-guide 介绍更新为 **"16-ch sine wave test"**。
- **主题跟随走 score project spec §5.3（App issue #44/#46）**：monitor 页消费 App 的 `pnds:theme` postMessage（best-effort、最新值覆盖，App 在 iframe load / 切主题 / 焦点重获时重推），幂等写入 CSS 变量；未知或畸形消息静默忽略。实现是 `lib/theme-follow.js`——参数化参考实现（默认映射 + `options.variables` / `options.derive` / `options.onTheme` / `options.applyVariables`），供 LND / 模板等工程拷贝；server 以 `serveFile` 抽取的方式加了 `GET /__pnds/theme-follow.js` 路由（仅 monitor 端口——performer 端口保持 health-only + stub）。
- **默认映射：`sidebar-bg`→`--track`、`pill`→`--accent-soft`**（其余 bg/card/text/text-secondary/accent/danger 直同名）：`--track` 承担边框/空圆点/分隔线（面板面角色），`--accent-soft` 承担激活音色填充（recessed 填充角色）；四主题下激活填充上的文字 ≥4.5:1（`test/theme-follow.test.js` 断言）。状态色（绿/黄/灰）不直接映射 App warning——它是"填充色+label 色"组合，而消费页把状态画成文字；`statusVariables()` 按 card 亮度分档推导亮/暗两套（本页未用，供状态 UI 工程经 `options.derive` 取用）。
- **`?theme=<name>` 为前瞻支持**：App 目前不携带该参数；四套主题初值复制自 App 的 theme-variables.css（消息到达后原样覆盖）。参数缺席或未知时页面用自带默认配色，行为与从前完全一致。
- **语言跟随走网络参考文档 "Locale Following"（App issue #48 / v1.3.0，本工程 issue #1）**：monitor 页消费 App 的 `pnds:locale` postMessage（`{type, version:1, locale:'en'|'zh-CN'}`，负载为解析后的语言代码，精确比较——App 发送规范 BCP 47），与主题桥同一套推送机制（语言切换、iframe 加载、窗口聚焦、心跳），语义一致：单向、尽力而为、最新值胜、幂等、可静默忽略。实现是 `lib/locale-follow.js`——照 `lib/theme-follow.js` 的复制式参考实现模式（不共享包），`current()` / `subscribe()` 持有状态、重复投递不通知任何人、`<html lang>` 同步；server 加了 `GET /__pnds/locale-follow.js` 路由（仅 monitor 端口）。界面文案双语：`public/copy.js` 的 en / zh-CN 两张同形表，页面 `applyCopy()` 全量重渲染（副标题、主音量标签、Mute、全部 aria-label、QR 行）并订阅切换；**默认语言 en = 本工程的历史界面语言**，英文表逐字保留历史文案（测试锚定），静态 HTML 兜底同样携带英文默认值——无桥流量 / 无 JS 的会话渲染与从前完全一致。`?lang=<code>` 首帧初值，未知代码或缺席用默认语言。分层例外（如同 theme-follow 内嵌 App 侧主题数据）：`lib/locale-follow.js` 的 `DEFAULT_LOCALE` / `SUPPORTED_LOCALES` 是复制式参考实现留给拷贝方的两个工程参数（本工程 = 历史界面语言 en + `public/copy.js` 双语表），不算"作品特定逻辑"——加一种语言时随文案表一并改。
- **v1.2.0 计划（内置工具）**：用户计划在 PNDS App v1.2.0 中把 LND 与 MSG 变成 App 的内置工具；两者继续保持独立仓库，通过 package workflow 产出可运行 bundle；App 侧的 tools registry / 安装机制属于未来工作。

## 验证命令

```sh
npm run check   # node --check server.js lib/osc.js lib/audio-engine.js lib/qr.js lib/network.js lib/theme-follow.js lib/locale-follow.js public/copy.js
npm test        # node --test（unit / osc / integration / theme-follow / locale-follow，共 52 个）
```
