# Multichannel Signal Generator

[English](README.md) | **中文**

一个 PNDS 工具工程，用于检查多通道路由：16 路正弦测试音，在推子控制台上逐路开关，带总推子与手机遥控；仅以 **Internal** 音频模式运行。

## 使用方式

1. 在 PNDS App 里按 **⌘O**（打开）选择本 `.pnds` 工程包或解压后的文件夹，选择 **Internal Synth**、指定输出设备后**载入**。还没有 App？从 https://github.com/xO-xN/PNDS-App/releases/latest 下载（macOS）——无需安装 Node.js 或 SuperCollider，App 已内置两者。
2. 把 Mac 与演出设备接入同一局域网。
3. 在操作机的 monitor `http://<Host-LAN-IP>:6869/` 上操作：16 个测试音开关与总推子，默认全部静音。
4. 展开底部的「**手机控制**」并扫码，手机即可打开 monitor 页面，无需手输局域网地址。

monitor 跟随 App 的语言与主题。
