# MuseSync

## What This Is

跨平台实时同步音乐播放器。用户可以创建房间、邀请他人加入，多台设备同步播放同一首歌曲。音源来自网易云音乐 API，支持通过 cookie 解析 VIP 歌曲。完全匿名、无需账号，所有用户数据仅存储在本地。支持 iOS、Android、Web 三端。

## Core Value

多设备之间的播放状态实时同步 — 一个人按下播放，所有人同时听到音乐。

## Target Users

- 好友/情侣远程一起听歌
- 音乐爱好者分享好音乐
- 社群活动中同步背景音乐
- 在线电台/直播场景

## Problem

现有音乐平台（网易云音乐、QQ音乐等）自带的一起听歌功能存在痛点：
1. 不同用户偏好不同音乐平台，无法跨平台一起听歌
2. 大部分歌曲需要会员才能播放，限制使用
3. 部分平台同步精度和稳定性不佳

MuseSync 通过统一音源 + 高精度时间同步算法 + 跨平台客户端解决这些问题。

## Requirements

### Validated

<!-- 已在代码库中实现的能力 -->

- ✓ 搜索网易云音乐并获取歌曲信息（标题、艺术家、封面、音频 URL） — existing
- ✓ 创建房间并生成 6 位数字房间码 — existing
- ✓ 通过房间码加入房间 — existing
- ✓ Socket.io 实时同步播放状态（播放/暂停/进度/歌曲切换） — existing
- ✓ NTP-like 时间校准算法（计算客户端-服务器时间偏移） — existing
- ✓ Last-Write-Wins 冲突解决与版本号控制 — existing
- ✓ 跨平台音频播放（Web Audio API + React Native Track Player） — existing
- ✓ 播放历史记录（本地存储） — existing
- ✓ 连接状态指示器（已连接/连接中/断开） — existing
- ✓ WebSocket 自动重连与指数退避 — existing
- ✓ 深色主题 UI — existing
- ✓ 房间成员管理（加入/离开/断线检测） — existing
- ✓ 音频 URL 缓存（20 分钟 TTL） — existing
- ✓ REST API 限流保护 — existing
- ✓ 设置页面（API URL 配置） — existing
- ✓ 歌词滚动显示与翻译切换 — existing

### Active

<!-- 当前范围，待构建 -->

- [ ] 播放列表管理（添加、删除、拖动排序，房间内同步）
- [ ] 三种权限模式（房主优先：只有房主可操作；共享模式：任何人可操作；队列模式：每人可点歌，按顺序播放）
- [ ] 移动端后台播放（锁屏通知栏控制）
- [ ] 网络断开后自动恢复同步状态

### Out of Scope

- EQ 均衡器 — 非核心功能，已从代码中移除占位符
- 播放进度漂移补偿 — 延后到 v2，当前同步精度可接受
- 浅色主题支持 — 延后到 v2
- HRTF 空间音效 / 虚拟环绕声 — 实现复杂度高，延后到核心功能稳定后
- 用户账号系统 / 跨设备数据同步 — 产品定位为匿名本地存储
- 多音源支持 — 当前仅网易云音乐，后续可扩展
- 实时聊天 — 不是核心功能
- 视频播放 — 超出产品范围

## Context

- 项目使用 monorepo 结构：`app/`（React Native + Expo）、`backend/`（Node.js + Express + Socket.io）、`shared/`（类型定义和常量）
- 之前使用 Spec-Kit 工作流，现已迁移到 GSD
- 包管理器已从 Bun 迁移到 Yarn 4.12.0，linting 从 ESLint/Prettier 迁移到 oxlint/oxfmt
- 后端使用内存存储（Map），无持久化数据库，服务器重启会丢失所有房间数据
- 网易云音乐 API 通过 `@neteasecloudmusicapienhanced/api` npm 包集成，支持 cookie 解析 VIP 歌曲
- 无测试框架，无单元测试覆盖
- 详细的 codebase 分析见 `.planning/codebase/`

## Constraints

- **Tech Stack**: TypeScript strict + React Native 0.81.5 + Expo 54 + Socket.io — 已确定，不可变更
- **Audio Engine**: Web Audio API (Web) + React Native Track Player (Native) — 平台特定实现
- **Storage**: 纯本地存储（AsyncStorage/LocalStorage），服务器不存储用户数据
- **Music Source**: 网易云音乐 API — 外部依赖，无 SLA，需缓存策略
- **Performance**: 同步延迟 < 500ms，播放响应 < 300ms
- **Room Limits**: 房间 ID 6 位数字，建议 10-20 人，所有人离开后自动销毁
- **Sync Strategy**: 以服务器时间为基准，所有客户端追赶服务器时间
- **Privacy**: 不存储用户数据，仅传递播放状态，用户数据本地持久化

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| 匿名模式，无账号系统 | 降低复杂度，保护隐私，降低使用门槛 | ✓ Good |
| Last-Write-Wins 冲突解决 | 简单有效，适合小房间场景 | ✓ Good |
| 内存存储而非数据库 | 房间数据是临时的，无需持久化 | ⚠️ Revisit（无法水平扩展） |
| 三种权限模式 | 满足不同使用场景（房主控制、自由协作、队列点歌） | — Pending |
| 以服务器时间为同步基准 | 避免房主设备影响所有人，提高稳定性 | ✓ Good |
| 从 Bun 迁移到 Yarn 4 | Expo 生态兼容性更好 | ✓ Good |
| 从 ESLint/Prettier 迁移到 oxlint/oxfmt | 更快的 lint 速度 | ✓ Good |
| 从 Spec-Kit 迁移到 GSD | 更适合迭代开发的工作流 | — Pending |
| 移除 EQ 均衡器 | 非核心功能，增加代码复杂度，延后实现 | ✓ Good |

---
*Last updated: 2026-02-14 after requirements refinement*
