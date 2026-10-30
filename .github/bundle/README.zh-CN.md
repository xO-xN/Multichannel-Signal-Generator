# Multichannel Signal Generator

[English](README.md) | **中文**

一个 PNDS 工具工程，用于检查多通道路由：16 路正弦测试音，在推子控制台上逐路开关，带总推子与手机遥控；仅以 **Internal** 音频模式运行。

## 使用方式

1. 在 PNDS App 里按 **⌘O**（打开）选择本 `.pnds` 工程包或解压后的文件夹，选择 **Internal Synth**、指定输出设备后**载入**。还没有 App？从 https://github.com/xO-xN/PNDS-App/releases/latest 下载（macOS）——无需安装 Node.js 或 SuperCollider，App 已内置两者。
2. 把 Mac 与演出设备接入同一局域网。
3. 在操作机的 monitor `http://<Host-LAN-IP>:6869/` 上操作：16 个测试音开关与总推子，默认全部静音。
4. 显示 App 演奏端二维码，用手机扫码。performer（:6868）与 monitor（:6869）共用控制台并同步服务器状态。

monitor 跟随 App 的语言与主题。


运行条件：本版采用固定 App 共享库，需 PNDS App v1.6.2 或更新且具备 manifest 声明的确切资源。工程包不重复携带运行库；创作机 standalone 调试仍可 npm ci。详情见维护仓库 docs/shared-libraries.md。

## App 演奏端二维码迁移

本版本移除工程自己的二维码界面与 `/qr` 端点。支持内置演奏端二维码的 PNDS App 中，演出模式使用底栏按钮，创作模式使用演奏者栏按钮；手机进入当前工程的 performer 页面。独立浏览器及旧版 App 仍可使用原页面，但不再提供页内扫码入口。
