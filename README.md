# Multichannel Signal Generator

[English](#english) | [中文](#中文)

---

## English

A PNDS utility score project: a **16-ch sine wave test** (16 independent mono sine tones, `toneTest` SynthDef) for checking Internal multichannel routing. Audio-only: the server always runs in `internal` mode (`defaultMode: "internal"`, `supportedModes: ["internal"]`, 16 output channels) — no external audio modes. Stack: Node.js (raw `http`, no Express, no Socket.IO, no p5) plus a minimal OSC UDP encoder to the App-hosted scsynth.

### Features

- **16 independent test tones**: one mono `toneTest` sine per channel, tuned `440 Hz × 2^((n−1)/12)` (channel 1 = concert A, channel 13 = one octave up)
- **Per-channel private buses**: tone *i* writes only its own bus `PNDS_AUDIO_OUTPUT_BUS + i` — never hardware bus 0, never downmixed
- **All muted by default**: every tone starts silent; toggle any of the 16 buttons to hear it
- **Master fader**: 0..1 volume (0 = Mute, 1 = 0 dBFS unity, default −6 dBFS) with ~20 ms smoothing, so toggles don't click
- **JSON API**: `POST /api/tone {channel, on}` (channel 1..16) and `POST /api/master {value 0..1}` on both ports
- **Phone and desktop control**: performer and monitor share the responsive console, authoritative state and one audio engine; open the bottom network popover, share its public HTTP URL/QR and explicitly enter the displayed performance from a phone
- **Graceful shutdown**: SIGINT/SIGTERM release the scsynth group, the UDP socket and both HTTP servers
- **Theme following**: inside PNDS App (≥ v1.2.3) the monitor page follows the App color theme (all four themes) via the `pnds:theme` bridge — `lib/theme-follow.js`, served at `/__pnds/theme-follow.js`
- **Bilingual UI (locale following)**: inside PNDS App (≥ v1.3.0) the monitor page follows the App language (en / zh-CN, live switching) via the `pnds:locale` bridge — `lib/locale-follow.js` served at `/__pnds/locale-follow.js`, copy tables in `public/copy.js`

### Getting Started

In PNDS App, load the project in Internal mode; the local monitor opens
automatically. Share the full public LAN HTTP URL or QR from the bottom network
popover, then explicitly enter the displayed performance on each phone. Internal
ports may change; use the actual monitor URL in runtime details if opening it
manually.

For standalone development only:

```sh
npm install
npm start    # http://<Host-LAN-IP>:6868/ performer · :6869/ monitor
```

In standalone mode, both preferred ports serve the same control console and API.
Refreshing or joining from a second device restores the server's current channel
and master state. These direct addresses are a standalone/legacy fallback, not
the stable saved App entry.

Source repository: https://github.com/xO-xN/Multichannel-Signal-Generator

Full documentation: [`docs/creator-guide.md`](docs/creator-guide.md) (creator guide) and
[`docs/handoff.md`](docs/handoff.md) (developer handoff notes).

### Structure

```
lib/            Reusable core (shared across all PNDS projects)
public/         Browser side (16-fader monitor page)
test/           Regression tests
docs/           Creator guide and handoff notes
supercollider/  Compiled .scsyndef artifact + build-time source
```

### License

MIT — see [LICENSE](LICENSE).

---

## 中文

一个 PNDS 实用工具工程：**16-ch sine wave test**（16 路独立单声道正弦测试音，`toneTest` SynthDef），用于检查 Internal 多声道路由。纯音频工具：server 恒以 `internal` 模式运行（`defaultMode: "internal"`、`supportedModes: ["internal"]`、16 路输出），无外部音频模式。技术栈：Node.js（原生 `http`，无 Express / Socket.IO / p5）+ 极简 OSC UDP 编码器，直连 App 托管的 scsynth。

### 功能

- **16 路独立测试音**：每通道一个单声道 `toneTest` 正弦，`440 Hz × 2^((n−1)/12)` 半音阶梯（通道 1 = 440 Hz 音乐会 A，通道 13 = 880 Hz 高八度）
- **每路私有总线**：第 i 路只写自己的总线 `PNDS_AUDIO_OUTPUT_BUS + i`——绝不写硬件总线 0，绝不下混
- **默认全部静音**：所有音初始为 Mute，点任意开关才发声
- **主音量推子**：0..1 音量（0 = Mute，1 = 0 dBFS unity，默认 −6 dBFS），~20 ms 平滑，无咔嗒声
- **JSON API**：monitor 端口提供 `POST /api/tone {channel, on}`（channel 1..16）与 `POST /api/master {value 0..1}`
- **手机与本机控制**：performer 与 monitor 共用响应式控制台和服务器状态，从 App 底栏网络弹层分享公开 HTTP 网址／二维码，再明确进入所显示的演出
- **优雅关闭**：SIGINT/SIGTERM 释放 scsynth 组、UDP socket 与两个 HTTP server
- **主题跟随**：在 PNDS App（≥ v1.2.3）中运行时，monitor 页通过 `pnds:theme` 消息实时跟随 App 主题（全部四套）；实现为 `lib/theme-follow.js`，经 `/__pnds/theme-follow.js` 提供给页面
- **界面双语（语言跟随）**：在 PNDS App（≥ v1.3.0）中运行时，monitor 页通过 `pnds:locale` 消息实时跟随 App 语言（en / zh-CN）；实现为 `lib/locale-follow.js`，经 `/__pnds/locale-follow.js` 提供给页面，文案表在 `public/copy.js`

### 开始

在 PNDS App 中以 Internal 模式载入后，本机 monitor 自动打开。从底栏网络弹层
分享完整公开 LAN HTTP 网址或二维码，让手机明确进入所显示的演出。内部端口可能
动态分配；如需手动打开 monitor，请使用运行详情中的实际网址。

以下固定首选端口仅供独立开发调试：

```sh
npm install
npm start    # http://<Host-LAN-IP>:6868/ performer · :6869/ monitor
```

独立运行时 performer 与 monitor 均提供同一控制台和 API；刷新或加入第二台设备时
恢复服务器通道与总推子状态。这些直接地址属于独立运行／旧版兼容路径，不是 App
跨工程保存的稳定入口。

仓库：https://github.com/xO-xN/Multichannel-Signal-Generator

完整说明见 [`docs/creator-guide.md`](docs/creator-guide.md)（创作指南）与
[`docs/handoff.md`](docs/handoff.md)（开发交接笔记）。

### 结构

```
lib/            可复用核心（PNDS 工程通用）
public/         浏览器端（16 路测试音 monitor 页）
test/           回归测试
docs/           指南与交接文档
supercollider/  编译产物 .scsyndef + 构建源码
```

### 许可证

MIT — 详见 [LICENSE](LICENSE)。


Runtime requirements: PNDS App v1.6.2 or a Host supporting the exact shared libraries in manifest.json. The project bundle carries references and project assets; standalone development can still use npm ci. See docs/shared-libraries.md in the source repository.

## App performer QR migration

The project has no in-page QR interface or `/qr` endpoint. Performance mode uses
the public HTTP URL/QR in the App's bottom network popover with explicit entry
into the displayed performance. Creation device tests keep their separate
Performers button; direct addresses remain a standalone/legacy fallback.

## 统一池主入口（1.4.0）

在已适配的 PNDS Host 中，使用底栏网络区复制或扫码完整公开地址，再明确进入所显示的演出。手机控制台和本机 monitor 控制同一个音频引擎；通道开关、逐通道音量与总推子均以服务器状态为准。通道音量默认 unity，与总推子相乘；测试音仍默认关闭。后加入、刷新或重连只恢复控制状态，不重启音频。

脚本与 HTTP 控制始终使用已确认演出的 URL 前缀；停止或换演出撤销旧网络访问，新演出需再次明确进入。页面取得有效权威状态后才报告准备。内部端口可由 App 动态分配，直接工程地址仍作为独立／旧版访问方式，不能当作跨工程保存入口。所需资源均随包，本工具不依赖公网、Worker、WebSocket、传感器或媒体权限；保存图标不会增加 HTTP 权限。原生池客来源／恢复及原有直接／HTTPS 访问不变。

自动化使用假 scsynth，真实手机与扬声器输出仍需实机验收。
