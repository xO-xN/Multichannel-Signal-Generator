# Multichannel Signal Generator — Creator Guide（创作者开始指南）

这是一个 **Internal 纯音频测试工具** 的 PNDS 工程：**16-ch sine wave test**（16 路独立单声道正弦测试音，`toneTest` SynthDef），每路只写自己的私有总线，用于检查 Internal 多声道路由。仅支持 `internal` 模式（`defaultMode: "internal"`、`supportedModes: ["internal"]`、`outputChannels: 16`）。

## 快速开始

### 1. 安装依赖

PNDS App **不执行 npm install**，所以发布包必须预装可用的 `node_modules/`（本地仓库仍以 `.gitignore` 排除 `node_modules/`，首次使用执行下面的命令；集成测试的 preflight 也要求 `qrcode` 已装在 `node_modules`）：

```sh
npm install
```

唯一的生产依赖是 `qrcode`（`^1.5.4`，只用于 monitor 的 `/qr` 端点）。

### 2. 运行

脱离 App 单独调试：

```sh
npm start    # 启动 performer/monitor 两个 HTTP server + 音频引擎
```

单独调试时需要一个在听的 scsynth 才能达到 `ready`（默认 OSC 目标 `127.0.0.1:57110`，可用 `PNDS_OSC_TARGET` 覆盖）；没有 scsynth 时两个 HTTP server 仍会起来，health 停在 starting/error。

在 PNDS App 中运行：App 中点击 **Open**，选择本文件夹。App 按 `manifest.json` 的 `audio` 块启动 scsynth（blockSize 64 / audioBusChannels 128；采样率来自 App 全局采样率偏好，未设置时 48000）并加载 `synthdefs`，然后以 internal 模式启动 server。

### 3. 两个端口

| 端口 | 地址 | 用途 |
|---|---|---|
| Performer | `http://<Host-LAN-IP>:6868/` | 无 UI（"This utility has no performer UI…" stub 页），只服务 `/__pnds/health` |
| Monitor | `http://<Host-LAN-IP>:6869/` | 16 路测试音 fader 页 + JSON API + `/qr` |

默认端口来自 `manifest.json` 的 `scoreServer.performerPort` / `monitorPort`——这是**唯一来源**。

## 16 路测试音（tone / master API）

本工程的作品语义是**16 路独立测试音**，Monitor 页面即为控制台：

- **页面**（`public/index.html`，单页，DOM，无 p5）：标题 "Multichannel Signal Generator"，16 个开关按钮 + 主音量推子（默认 −6 dBFS），底部 QR 行（指向 monitor 页 :6869，副标题 "Scan to open the monitor page"）。所有音默认静音（Mute）。界面文案双语（en / zh-CN，渲染自 `public/copy.js`），在 App 内随 App 语言实时切换（见"语言跟随"一节）。
- **开关**：点击按钮 → `POST /api/tone {channel, on}`；server 校验 `channel` 必须是 1..16 的整数，否则 400。
- **主音量**：拖动推子 → `POST /api/master {value 0..1}`；server 校验 `value` 必须是 0..1 的有限数，否则 400。映射到 −60..0 dBFS（0 = Mute，1 = 0 dBFS unity），默认 −6 dBFS；只推给已开启的音。
- **音频引擎**（`lib/audio-engine.js`，作品逻辑所在）：组 1000（App 保留范围之下），实例 1001..1016；第 i 路只写私有总线 `PNDS_AUDIO_OUTPUT_BUS + i`；频率 `440 Hz × 2^((n−1)/12)`（通道 1 = 440 Hz 音乐会 A，通道 13 = 880 Hz 高八度）；`gain` 经 `Lag.kr(gain, 0.02)` 平滑（~20 ms），无咔嗒声。
- **OSC**（`lib/osc.js`）：零依赖极简编码器，osc-min 兼容线上格式（4 字节对齐、数字一律按 float 编码，与 bundled scsynth 3.14.1 对齐），已知字节 fixtures 见 `test/osc.test.js`。
- **QR**：`/qr` 只挂在 monitor server，返回 monitor 页 `http://<LAN-IP>:6869/` 的 PNG（`lib/qr.js` + `lib/network.js`，`PNDS_HOST_IP` 可覆盖 LAN 地址）；performer 端口对 `/qr` 返回 404。
- **优雅关闭**：SIGINT/SIGTERM → 释放组（`/g_freeAll`）、关闭 UDP socket 与两个 HTTP server，退出码 0（集成测试断言端口释放）。
- **环境变量覆盖**：`PNDS_AUDIO_OUTPUT_BUS`（首个私有总线，默认 0）、`PNDS_AUDIO_OUTPUT_CHANNELS`（默认 16）、`PNDS_OSC_TARGET`（默认 127.0.0.1:57110）、`PNDS_PERFORMER_PORT` / `PNDS_MONITOR_PORT`（默认 manifest 端口）、`PNDS_HOST_IP`。

## 主题跟随（App 集成）

在 PNDS App（≥ v1.2.3）中运行时，monitor 页通过跨域 `postMessage` 接收 App 推送的主题（score project spec §5.3：`pnds:theme` 消息，含最终颜色值 palette），幂等地写入页面 CSS 变量——App 打开 monitor、切换主题、窗口重获焦点时都会重推，页面始终与 App 一致（Lavender / Sand / Stage / Brutal 全部四套）。实现是 `lib/theme-follow.js`（可复用参考实现，供其他 PNDS 工程拷贝），由 server 经 `GET /__pnds/theme-follow.js` 提供给浏览器（与 `/__pnds/health` 同属 App 契约命名空间，仅 monitor 端口）。页面接入只需一行：

```html
<script src="/__pnds/theme-follow.js"></script>
```

零配置即生效（默认 palette → CSS 变量映射）。进阶用法（重命名变量、按 palette 推导额外变量、`onTheme` 回调做整套设计分叉、关闭 CSS 写入只走回调）见 `lib/theme-follow.js` 头部注释——在 script 标签之前设置 `window.PNDS_THEME_OPTIONS`。加载时支持 `?theme=<name>` 查询参数作为首帧初值（App 目前不携带该参数，缺席时用工程自带配色，行为与从前完全一致）。

## 语言跟随（App 集成）

在 PNDS App（≥ v1.3.0）中运行时，monitor 页通过跨域 `postMessage` 接收 App 推送的语言（网络参考文档 "Locale Following" 一节：`pnds:locale` 消息，负载为解析后的语言代码 `en` / `zh-CN`），与主题桥完全同一套推送机制（语言切换、iframe 加载、窗口聚焦、心跳）、同样的语义（单向、尽力而为、最新值胜、幂等、不实现则完全不受影响）。实现是 `lib/locale-follow.js`（可复用参考实现，供其他 PNDS 工程拷贝），由 server 经 `GET /__pnds/locale-follow.js` 提供给浏览器（仅 monitor 端口）。页面接入只需一行：

```html
<script src="/__pnds/locale-follow.js"></script>
```

页面的全部界面文案渲染自 `public/copy.js` 的双语表（en / zh-CN，en 表 = 历史文案逐字保留——无桥流量的会话渲染与从前完全一致；默认语言 `en` 即本工程的历史界面语言）。页面持有当前 locale 并订阅切换实时重渲染（副标题、主音量标签、dBFS 的 Mute、全部 aria-label、QR 行）；`<html lang>` 同步。`?lang=<code>` 查询参数作为首帧初值（未知代码或缺席时用默认语言）。改文案只需改 `public/copy.js`——两个语言的表共享同一 key 形状（`test/locale-follow.test.js` 断言），加 key 不会漏一种语言。

## 目录结构

```
manifest.json             PNDS 工程契约（App 只认它和 server 入口；audio 仅声明 internal）
server.js                 作品主 server：performer/monitor 两个 HTTP server + 路由与 API 校验 + 生命周期
lib/                      可复用核心，任何 PNDS 工程通用（template 骨架）
  network.js              LAN IPv4 枚举（resolveHostLanIp，PNDS_HOST_IP）
  qr.js                   monitor 页面 QR 码（node 原生 handler，无 Express）
  osc.js                  极简 OSC 编码器 + UDP 客户端（零依赖，osc-min 兼容线上格式）
  audio-engine.js         16 路 toneTest 实例（组 1000 / 实例 1001..1016）——作品语义所在
  theme-follow.js         主题跟随（App ≥ v1.2.3）：消费 pnds:theme 消息，写入页面 CSS 变量
  locale-follow.js        语言跟随（App ≥ v1.3.0）：消费 pnds:locale 消息，持有当前 locale
public/                   浏览器端
  index.html              16 路测试音 monitor 页（单页，DOM + 内联样式，无 p5）
  copy.js                 双语文案表（en / zh-CN），monitor 页经当前 locale 的表渲染
test/                     node --test 回归测试（unit / osc / integration / theme-follow / locale-follow）
supercollider/
  synthdefs/              编译产物 .scsyndef + 构建源码（toneTest）
docs/                     本指南与交接文档
```

## 创作时改什么

| 想做什么 | 改哪里 |
|---|---|
| 换作品名 / 端口 / 输出通道数 | `manifest.json`（改端口只需改这里） |
| 改 monitor 页面（16 个开关、主推子、QR 行） | `public/index.html`（单页，DOM + 内联样式） |
| 改主题跟随 | `lib/theme-follow.js`（palette → CSS 变量映射、onTheme / derive 口子、`?theme=` 初值） |
| 改语言跟随 | `lib/locale-follow.js`（消息解析、`?lang=` 初值、current/subscribe 状态） |
| 改界面文案 / 加一种语言 | `public/copy.js`（双语表）+ `lib/locale-follow.js` 的 SUPPORTED_LOCALES |
| 改频率 / 增益映射 / 主音量默认 / 实例数 | `lib/audio-engine.js`（toneFrequency / faderValueToGain / DEFAULT_MASTER_GAIN / TONE_COUNT） |
| 改 API 校验（channel 1..16、value 0..1） | `server.js`（handleToneRequest / handleMasterRequest） |
| 改 OSC 编码 / 参数类型 | `lib/osc.js` |
| 改音色（波形 / 平滑时间） | `supercollider/synthdefs/source/*.scd`，重新编译出 `.scsyndef` |

## 单一事实来源（Single Source of Truth）

- **端口与音频声明**的唯一来源是 `manifest.json`（App 工程契约）：performerPort / monitorPort、defaultMode、supportedModes、outputChannels、scsynth 参数、synthdefs。`server.js` 从它读取（可用环境变量覆盖），创作者只需改 manifest.json。
- **tone 规则**（频率阶梯、增益映射、Mute/主音量）的权威在 `lib/audio-engine.js`；monitor 页面为了显示在本地复算同样的公式（`toneFrequency`、`valueToDb`），两者必须保持一致——`test/unit.test.js` 锚定服务端一侧。
- 本工程**没有**浏览器/服务端共用规则模块（不同于 LND 的 `shared.js`）：浏览器只做显示与 POST，规则与校验全部在服务端（`server.js` 校验边界、`lib/audio-engine.js` 实现规则）。例外是纯数据的 `public/copy.js`（双语文案表）：浏览器与 `test/locale-follow.test.js` 共用，key 形状由测试锚定。

## 音频

本工程**仅 internal 模式**：`audio.defaultMode: "internal"`、`supportedModes: ["internal"]`、`outputChannels: 16`；scsynth 以 manifest 的 blockSize 64 / audioBusChannels 128 与 App 全局采样率偏好（未设置时 48000）启动，并加载 `supercollider/synthdefs/multichannel-signal-generator.scsyndef`（`toneTest`）。

- 16 个实例只写自己的私有总线（`PNDS_AUDIO_OUTPUT_BUS + i`），绝不写硬件总线 0、绝不下混；App master stage 只负责把私有总线桥接到硬件。
- 所有音默认静音（Mute）；主音量默认 −6 dBFS；`Lag.kr(gain, 0.02)` 平滑 ~20 ms。
- 启动序列：`/d_load` → `/done` → `/sync` → `/synced` → `/g_new(1000)` → 16× `/s_new` → `/sync` → `/synced`；ready 要求全部实例确认（运行契约 §8）。

## 健康检查

两个端口都提供：

```sh
curl http://127.0.0.1:6868/__pnds/health
```

PNDS App 以 JSON 中 `status === "ready"` 为显示条件。ready 的前置条件：performer/monitor 两个 HTTP server 都监听成功 **且** 音频引擎确认 16 个实例存在。payload 含 `projectId`、`audioMode`（"internal"）、`audio.status` / `audio.target`、`scoreServer` 端口。

## test/ 文件夹

`test/` 是给 AI 编程助手用的回归测试（`npm test`，node --test，共 52 个）。创作者不需要手动运行，也不需要理解它们。当你通过 AI 修改工程时，AI 会用它来验证改动没有破坏已有功能：unit（频率数学、增益映射、tone/master 规则，假 OSC client）、osc（与 osc-min 逐字节对照的已知 fixtures）、integration（假 scsynth UDP harness → server 达到 ready；manifest 契约含 synthdef 产物存在；preflight 要求 qrcode 依赖已装在 node_modules；health payload；performer stub + monitor 页；`/qr` 返回 image/png 含 PNG magic 且 performer 端口 404；tone/master API 校验；SIGTERM 干净退出 0 且端口释放）；theme-follow（消息 → CSS 变量、幂等、畸形忽略、四主题 ≥4.5:1、`?theme=` 初值、浏览器接线，含 `/__pnds/theme-follow.js` 路由断言）；locale-follow（消息解析与畸形忽略、`?lang=` 初值、幂等重推、浏览器接线与 `<html lang>` 同步、双语表同形且英文表 = 历史文案、页面加载顺序与静态兜底，含 `/__pnds/locale-follow.js` 路由断言）。

## 发布

带生产依赖的发布包由 `.github/workflows/package.yml` 构建（ALLOWLIST 裁剪；`node_modules` 预装；`supercollider/` 显式纳入——`.scsyndef` 是运行时依赖）。详见 `docs/handoff.md`。
