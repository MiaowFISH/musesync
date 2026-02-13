# Phase 1: Bug Fixes & Foundation - Context

**Gathered:** 2026-02-14
**Status:** Ready for planning

<domain>
## Phase Boundary

修复两个阻塞性 bug：版本号在切歌时重置为 0（BUGF-01）和 Socket 重连时的 ID 竞态条件（BUGF-02）。这两个 bug 分别阻塞 Phase 2 的播放列表同步和 Phase 3 的网络恢复功能。修复后，现有的播放/暂停/seek/切歌同步功能必须继续正常工作，无回归。

</domain>

<decisions>
## Implementation Decisions

### 版本号修复策略
- 服务端为版本号的权威来源，客户端每次操作向服务端请求新版本号
- 切歌时版本号递增，不重置 — 版本号只增不减
- 版本号溢出时回绕到 1，服务端处理回绕逻辑
- 版本号生命周期跟随房间 — 房间创建时从 1 开始，房间销毁后自然重置

### 重连竞态处理
- 客户端生成持久化 UUID（存储在本地），重连时携带该 ID，服务端用 clientId 而非 socket ID 识别用户
- 服务端检测到同一 clientId 的新连接后，给旧连接一个短暂宽限期（如 2-3 秒），宽限期后踢掉旧连接
- 重连成功后，服务端主动推送当前房间的完整状态（当前歌曲、播放位置、版本号等），客户端直接覆盖本地状态

### 回归防护
- Phase 1 不写自动化测试，纯修 bug
- 列出手动验证场景清单，供修复后验证使用
- 验证范围覆盖 bug 修复 + 核心同步功能回归（播放/暂停/seek/切歌同步）

### 边界场景行为
- 快速连续切歌时做防抖处理，只处理最后一次切歌操作
- 重连过程中用户的操作（切歌、播放/暂停等）直接丢弃，重连成功后以服务端状态为准
- 多设备同时断线重连时（如服务器短暂重启），服务端等待一个短暂窗口（如 3 秒）后批量处理重连请求，减少重复广播
- 断线期间客户端禁用播放控制按钮，显示「重连中...」状态

### Claude's Discretion
- 宽限期和批量处理窗口的具体时长
- 防抖的具体实现方式和延迟时间
- 版本号回绕的具体阈值
- 断线 UI 的具体样式和动画

</decisions>

<specifics>
## Specific Ideas

- 服务端是所有状态的权威来源 — 任何冲突场景都以服务端为准
- 重连后的状态恢复是「服务端推送完整快照」模式，不做增量合并
- 断线期间的用户体验要明确：禁用控制 + 状态提示，不要让用户以为操作生效了

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-bug-fixes-foundation*
*Context gathered: 2026-02-14*
