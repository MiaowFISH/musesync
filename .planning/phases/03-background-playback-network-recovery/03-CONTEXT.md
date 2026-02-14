# Phase 3: Background Playback & Network Recovery - Context

**Gathered:** 2026-02-14
**Status:** Ready for planning

<domain>
## Phase Boundary

音乐在 app 进入后台时继续播放，锁屏显示播放控制，网络断开时优雅降级，恢复后自动重新同步房间状态。不包含离线缓存、下载功能或新的播放模式。

</domain>

<decisions>
## Implementation Decisions

### 后台播放体验
- 锁屏控件：播放/暂停 + 上一首/下一首 + 进度条拖动（类似 Spotify）
- 锁屏/通知栏信息：歌曲名 + 歌手名 + 封面图
- 队列播完行为：遵循当前循环模式（列表循环从头开始，单曲循环重复，无循环则停止）
- 后台同步策略：后台时独立播放，不响应房间同步事件（别人切歌/暂停不影响后台播放）

### 前后台切换同步
- 回前台时自动拉取房间最新状态并同步，同时用 Toast 通知用户发生了什么变化（如「房间已切到第3首」）
- Toast 仅作通知，同步是自动的，用户无需手动操作
- UI 更新采用平滑过渡动画（封面渐变、进度条动画滑动），不是硬切

### 网络断开与恢复
- 断线提示：播放界面顶部显示横幅（红色/黄色），如「网络已断开，正在重连...」
- 离线播放行为：断网后继续播放当前已缓冲的音频，播完当前歌后停止（不切歌）
- 重连策略：自动重连 + 指数退避（1s, 2s, 4s...），多次失败后显示「重新连接」按钮让用户手动触发
- 重连后同步：与前后台切换保持一致 — 自动同步房间最新状态 + Toast 通知变化

### Claude's Discretion
- 指数退避的具体参数（最大重试次数、最大间隔）
- 横幅的具体颜色和动画
- 平滑过渡动画的具体实现方式
- 锁屏控件的平台适配细节
- 过期状态（>60s）的具体拒绝逻辑

</decisions>

<specifics>
## Specific Ideas

- 后台独立播放 + 回前台自动同步的模式：用户在后台听自己的节奏，回来时无缝回到房间状态，不会被后台的房间变化打断
- 断线和回前台的同步逻辑应该复用同一套机制，保持体验一致性
- Toast 通知风格与 Phase 2 中队列操作的 Toast 保持一致

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-background-playback-network-recovery*
*Context gathered: 2026-02-14*
