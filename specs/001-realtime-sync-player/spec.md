# Feature Specification: 多设备实时同步音乐播放器

**Feature Branch**: `001-realtime-sync-player`  
**Created**: 2026-01-02  
**Status**: Draft  
**Input**: 用户需求 - "开发支持多设备实时同步播放的跨平台音乐应用，实现高保真音频处理和多端播放进度精准对齐（< 50ms）"

## 澄清记录 (Clarifications)

### Session 2026-01-02

- Q: 用户身份认证机制 - 是否需要账号系统支持跨设备数据同步？ → A: 不需要跨设备同步，所有数据仅保存至本地，采用完全匿名模式
- Q: 房间权限控制模型 - 默认权限和可控范围？ → A: 开放协作模式 - 默认所有成员可控制播放，房主可选开启"仅主持人模式"
- Q: 网易云音乐 API 备用方案 - 是否需要多音源支持？ → A: 单一音源 + 增强缓存，后端使用 npm neteasecloudmusicapienhanced/api 库获取音乐数据
- Q: HRTF 空间音效实现优先级 - 是否在 P1/MVP 中实现？ → A: 分阶段实现 - P1 仅实现 EQ 均衡器，空间音效降为后续增强功能
- Q: 播放进度补偿算法的软同步阈值 - 速率调整范围和硬跳转策略？ → A: 保守软同步 - 误差 50-100ms 使用微调（1.0 ± 0.05x），> 100ms 硬跳转时使用淡入淡出效果减少用户感知

## 章程对齐声明 (Constitution Alignment)

本功能规格遵循 [MusicTogether 项目章程 v1.0.1](../../.specify/memory/constitution.md) 的以下核心原则：

- ✅ **I. 简洁架构**: 功能模块职责清晰（播放器、同步引擎、音频处理独立），避免过度抽象
- ✅ **II. 跨平台一致性与界面美观**: iOS/Android/Web 三端统一交互逻辑，界面简洁美观，菜单组织合理
- ✅ **III. 实时同步优先**: WebSocket (Socket.io) 实现播放状态同步，延迟目标 < 50ms
- ✅ **IV. 音质增强标准**: Web Audio API 实现 10频段 EQ、预设音效；空间音效（HRTF）作为 P4 增强功能
- ✅ **V. 代码质量与可维护性**: TypeScript strict 模式，Bun 运行时，关键逻辑有注释

**技术栈符合性检查**:
- ✅ Bun + TypeScript (Backend & Build)
- ✅ React Native 0.83.x + Expo (Cross-platform)
- ✅ Socket.io (WebSocket-based real-time communication)
- ✅ React Native Track Player (Mobile audio engine)
- ✅ Web Audio API (Audio processing & effects)

## 用户场景与测试 (User Scenarios & Testing)

### 用户故事 1 - 单设备音乐播放与音质调节 (Priority: P1 - MVP)

**描述**: 用户在单个设备上播放音乐，可自由调节 EQ 均衡器和空间音效，享受高品质音乐体验。

**为什么是 P1**: 这是核心播放功能，是所有后续功能的基础，必须首先实现并验证音频引擎稳定性。

**独立测试**: 无需网络连接或多设备，用户可在单台设备上完成播放、暂停、进度调节、EQ 调节等全部操作。

**验收场景**:

1. **Given** 用户打开应用并选择一首歌曲，**When** 点击播放按钮，**Then** 歌曲开始播放，显示波形动画和播放进度条
2. **Given** 歌曲正在播放，**When** 用户拖动进度条到 50% 位置，**Then** 播放立即跳转到对应时间点，延迟 < 300ms
3. **Given** 用户进入 EQ 设置页面，**When** 调节某个频段（如 1kHz +6dB），**Then** 音频实时应用该效果，无需重启播放
4. **Given** 用户选择预设音效"摇滚"，**When** 点击应用，**Then** EQ 参数自动调整到预设值，声音特征明显变化
5. **Given** 用户保存自定义 EQ 设置"我的调音"，**When** 重启应用后打开 EQ 页面，**Then** 自定义预设仍然存在并可加载
6. **Given** 应用在后台运行（移动端），**When** 锁屏或切换应用，**Then** 音乐继续播放，通知栏显示播放控制

---

### 用户故事 2 - 多设备创建/加入房间同步播放 (Priority: P2)

**描述**: 用户可创建房间并邀请其他设备加入，或加入已有房间，实现多设备同步播放同一首歌曲。

**为什么是 P2**: 这是产品的核心差异化功能，依赖 P1 的播放能力，但本身可作为独立功能演示。

**独立测试**: 准备 2 台设备（或使用 Web + 移动端模拟器），一台创建房间，另一台通过房间 ID 加入，验证同步效果。

**验收场景**:

1. **Given** 用户 A 在主界面，**When** 点击"创建房间"，**Then** 生成 6 位房间码并显示在界面顶部，Socket 连接建立成功
2. **Given** 用户 B 在主界面，**When** 输入用户 A 的房间码并加入，**Then** 成功进入房间，界面显示"已连接 2 人"
3. **Given** 房间已建立，用户 A 播放歌曲，**When** 点击播放，**Then** 用户 B 的设备自动开始播放同一首歌
4. **Given** 两台设备同步播放中，**When** 用户 A 暂停，**Then** 用户 B 的播放同步暂停，延迟 < 500ms
5. **Given** 两台设备播放进度不一致（如网络延迟），**When** 服务器发送校准指令，**Then** 客户端自动微调进度，同步误差收敛到 < 50ms
6. **Given** 用户 B 网络断开，**When** 重新连接，**Then** 自动恢复同步状态，播放进度补偿到当前服务器时间

---

### 用户故事 3 - 播放列表共享与协作控制 (Priority: P3)

**描述**: 房间内所有成员可查看共享播放列表，任意成员可添加歌曲或切换到下一首。

**为什么是 P3**: 增强协作体验，但不影响基础同步播放功能，可在 P1/P2 稳定后迭代。

**独立测试**: 房间内多个用户操作播放列表，验证列表状态同步和权限控制。

**验收场景**:

1. **Given** 房间内有 3 个用户（开放协作模式），**When** 用户 A 添加 5 首歌到播放列表，**Then** 所有用户界面同步显示相同的列表
2. **Given** 播放列表有 10 首歌（开放协作模式），**When** 任意成员点击"下一首"，**Then** 所有设备同步切换到下一首歌曲
3. **Given** 用户 B 拖动列表调整歌曲顺序（开放协作模式），**When** 释放拖动，**Then** 新顺序同步到所有设备，当前播放不受影响
4. **Given** 房间创建者开启"仅主持人控制"模式，**When** 普通成员尝试切歌或调整列表，**Then** 显示权限提示"仅房主可操作"，操作被拒绝
5. **Given** 房主在"仅主持人模式"下，**When** 点击"开放协作"切换按钮，**Then** 所有成员立即获得控制权限，界面显示"协作模式"标识

---

### 用户故事 4 - HRTF 空间音效增强 (Priority: P4 - 未来增强)

**描述**: 用户可以开启高级空间音效，获得虚拟环绕声和混响体验，增强沉浸感。

**为什么是 P4**: 这是高级音频处理功能，实现复杂度高，依赖 P1 的音频引擎基础，不影响核心播放和同步体验。

**独立测试**: 在 P1 播放功能稳定后，单独测试空间音效的音频处理效果和性能影响。

**验收场景**:

1. **Given** 用户在播放界面，**When** 开启"空间音效"开关，**Then** 音频切换到 HRTF 处理模式，听到立体声增强效果
2. **Given** 空间音效已开启，**When** 选择"演唱会模式"预设，**Then** 应用混响效果，模拟大型空间声场
3. **Given** 空间音效已开启，**When** 在低端设备上播放，**Then** 自动降级到"低质量模式"，确保播放流畅性
4. **Given** 空间音效消耗过多 CPU（> 15%），**When** 系统检测到性能压力，**Then** 显示提示"建议关闭空间音效以优化性能"

---

### 边缘场景 (Edge Cases)

- **网络波动**: 播放过程中网络断开 > 5 秒，客户端本地继续播放，重连后自动补偿进度差异
- **时间不同步**: 设备系统时间与服务器差异 > 10 秒，使用 NTP 校准算法计算时间偏移量
- **音频缓冲不足**: 播放卡顿时自动降低音质或暂停加载，避免破音
- **房间容量上限**: 单房间最多支持 50 人，达到上限后新用户无法加入并显示提示
- **并发控制冲突**: 两个用户同时操作播放器（如一个播放一个暂停），采用"最后写入优先"策略
- **跨平台兼容性**: Web 端不支持后台播放，需在界面提示用户保持标签页激活

## 功能需求 (Requirements)

### 功能需求 (Functional Requirements)

- **FR-001**: 系统必须支持从网易云音乐 API（使用 npm 包 `neteasecloudmusicapienhanced/api`）搜索和获取歌曲信息（歌名、艺术家、专辑封面、音频 URL）
- **FR-002**: 系统必须实现 10 频段图形均衡器（31Hz, 62Hz, 125Hz, 250Hz, 500Hz, 1kHz, 2kHz, 4kHz, 8kHz, 16kHz），每个频段可调节范围 -12dB 至 +12dB
- **FR-003**: 系统必须提供至少 5 种预设音效场景（流行、摇滚、古典、人声、电子）
- **FR-004**: 系统应当支持 HRTF 空间音频算法，提供虚拟环绕声和混响效果（P4 增强功能，非 MVP 必需）
- **FR-005**: 系统必须支持创建房间并生成唯一 6 位数字房间码
- **FR-006**: 系统必须支持通过房间码加入房间，最多支持 50 人同时在线
- **FR-007**: 系统必须通过 Socket.io 实时同步播放状态（播放/暂停/进度/歌曲切换）
- **FR-008**: 系统必须实现时间校准算法，计算客户端与服务器的时间偏移量（Local-Server Offset）
- **FR-009**: 系统必须在播放进度差异 > 100ms 时触发硬同步（带淡入淡出效果），差异 50-100ms 时使用软同步（播放速率微调 ± 5%），将误差收敛到 < 50ms
- **FR-010**: 系统必须支持移动端后台播放，锁屏后显示媒体通知和控制按钮
- **FR-011**: 系统必须在 iOS/Android/Web 三端提供一致的界面布局和交互逻辑
- **FR-012**: 用户必须能够保存自定义 EQ 配置并为其命名
- **FR-013**: 系统必须支持播放列表管理（添加、删除、拖动排序）
- **FR-014**: 系统必须在网络断开时显示连接状态指示器，重连后自动恢复同步
- **FR-015**: 系统必须记录用户播放历史（最近 100 首），支持快速重新播放
- **FR-016**: 房间必须默认为"开放协作模式"，所有成员可控制播放和播放列表
- **FR-017**: 房主必须能够切换到"仅主持人模式"，限制普通成员的控制权限

### 非功能需求 (Non-Functional Requirements)

- **NFR-001**: 应用冷启动时间必须 < 2 秒（移动端）
- **NFR-002**: 播放操作响应时间必须 < 300ms（点击播放到声音输出）
- **NFR-003**: 房间同步延迟必须 < 500ms（操作到其他设备响应）
- **NFR-004**: 播放进度同步误差必须收敛到 < 50ms（硬跳转使用 50ms 淡入淡出，软同步速率调整 ± 5%）
- **NFR-005**: EQ 音频处理 CPU 占用率必须 < 15%
- **NFR-006**: 应用运行内存占用必须 < 200MB（播放状态下）
- **NFR-007**: 支持 iOS 15+, Android 10+, 现代浏览器（Chrome 90+, Safari 14+）
- **NFR-008**: 界面必须支持深色/浅色主题切换
- **NFR-009**: 所有网络请求失败必须有重试机制（最多 3 次）
- **NFR-010**: 代码必须通过 TypeScript strict 模式检查和 ESLint 规范

### 核心实体 (Key Entities)

- **Room**: 房间实体，包含 roomId（房间码）、hostId（创建者）、members（成员列表）、playlist（播放列表）、currentTrack（当前播放曲目）、syncState（同步状态对象）、controlMode（控制模式：'open' 开放协作 | 'host-only' 仅主持人）
- **Track**: 曲目实体，包含 trackId、title、artist、album、coverUrl、audioUrl、duration
- **SyncState**: 同步状态对象，包含 trackId、status（playing/paused）、seekTime（播放位置）、serverTimestamp（服务器时间戳）
- **User**: 用户实体（仅本地），包含 userId（设备生成的唯一 ID）、username（随机昵称或用户自定义）、deviceId
- **EQPreset**: EQ 预设（存储在本地），包含 presetId、name、bands（10个频段的增益值数组）
- **LocalPreferences**: 本地偏好设置，包含 theme（主题）、eqPresets（自定义 EQ 列表）、playbackHistory（播放历史，最多 100 首）

## 成功标准 (Success Criteria)

### 可测量成果 (Measurable Outcomes)

- **SC-001**: 单设备播放功能完整可用，用户可在 30 秒内完成从搜索到播放的全流程
- **SC-002**: 两台设备在同一房间内播放同步误差测量值 < 50ms（使用示波器或音频分析工具验证）
- **SC-003**: EQ 调节实时生效，用户感知延迟 < 100ms
- **SC-004**: 90% 的用户在首次使用时能够成功创建房间并邀请他人加入（无需查看帮助文档）
- **SC-005**: 移动端后台播放稳定性测试，锁屏播放 1 小时无崩溃或中断
- **SC-006**: 网络断开后 5 秒内重连，同步恢复成功率 > 95%
- **SC-007**: 界面美观度用户满意度调查 > 4.0/5.0（简洁、无元素堆砌、操作流畅）
- **SC-008**: 跨平台一致性测试，三端核心功能操作步骤完全一致
- **SC-009**: 本地数据持久化测试，应用重启后 EQ 设置和播放历史完整保留

## 技术约束 (Technical Constraints)

### 平台与兼容性

- **iOS**: 最低支持 iOS 15，使用 React Native Track Player 实现后台播放
- **Android**: 最低支持 Android 10 (API 29)，需处理电池优化白名单
- **Web**: 支持 Chrome 90+, Firefox 88+, Safari 14+，WebSocket 和 Web Audio API 必须可用

### 音频处理限制

- **Web Audio API**: AudioContext 必须在用户交互后初始化（浏览器限制）
- **移动端音频**: iOS 需使用 AVAudioSession 配置音频会话，Android 需申请 FOREGROUND_SERVICE 权限
- **EQ 实现**: 使用 BiquadFilterNode 实现，每个频段独立节点，串联连接
- **空间音效（P4）**: Web 端使用 PannerNode + ConvolverNode，移动端使用原生 Audio Unit (iOS) 或 Oboe (Android)，需性能检测和降级策略

### 网络与性能

- **Socket.io**: 必须配置心跳检测（pingInterval: 25s, pingTimeout: 60s）和自动重连
- **二进制数据**: 同步消息使用 JSON，音频流（如果需要）使用 ArrayBuffer
- **带宽优化**: 音频文件优先使用流式加载，避免整首歌下载完再播放
- **并发处理**: 服务器使用 Bun 的原生异步能力，单实例支持 10,000 并发连接

### 数据持久化

- **本地存储**: 使用 AsyncStorage (React Native) 或 LocalStorage (Web) 存储所有用户数据，包括：
  - 自定义 EQ 预设
  - 播放历史（最近 100 首）
  - 主题偏好（深色/浅色）
  - 用户昵称和设备 ID
- **服务器存储**: 仅存储临时房间状态（内存存储，可选 Redis），不存储任何用户个人数据

## 技术设计提示 (Technical Design Hints)

### 架构概览

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (React Native + Expo)          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  UI Layer    │  │ Audio Engine │  │ Sync Client  │          │
│  │ (Screens &   │←→│ (Track Player│←→│ (Socket.io   │          │
│  │  Components) │  │  + Effects)  │  │   Client)    │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         ↑                  ↑                  ↑                  │
└─────────┼──────────────────┼──────────────────┼──────────────────┘
          │                  │                  │
          └──────────────────┼──────────────────┘
                             │ WebSocket
          ┌──────────────────┼──────────────────┐
          │                  ↓                  │
          │      Backend (Bun + Socket.io)      │
          │  ┌────────────────────────────┐     │
          │  │    Room Manager            │     │
          │  │  - 房间状态管理            │     │
          │  │  - 成员连接管理            │     │
          │  └────────────────────────────┘     │
          │  ┌────────────────────────────┐     │
          │  │    Sync Engine             │     │
          │  │  - 时间校准算法            │     │
          │  │  - 播放状态同步            │     │
          │  │  - 进度补偿算法            │     │
          │  └────────────────────────────┘     │
          │  ┌────────────────────────────┐     │
          │  │  NetEase Music API Proxy   │     │
          │  │  (neteasecloudmusicapi     │     │
          │  │   enhanced/api)            │     │
          │  │  - 搜索歌曲                │     │
          │  │  - 获取音频 URL            │     │
          │  │  - 歌曲详情查询            │     │
          │  │  - 本地缓存层              │     │
          │  └────────────────────────────┘     │
          └─────────────────────────────────────┘
```

### 关键算法伪代码

#### 1. 时间校准算法 (NTP-like)

```typescript
// 客户端发送时间同步请求
function syncTime() {
  const t0 = Date.now(); // 发送时间
  socket.emit('time_sync', { clientTimestamp: t0 });
}

// 服务器响应
socket.on('time_sync', (data) => {
  const t1 = Date.now(); // 服务器接收时间
  const t2 = Date.now(); // 服务器发送时间
  socket.emit('time_sync_response', { 
    clientTimestamp: data.clientTimestamp,
    serverReceiveTime: t1,
    serverSendTime: t2
  });
});

// 客户端计算偏移量
socket.on('time_sync_response', (data) => {
  const t3 = Date.now(); // 客户端接收时间
  const roundTripDelay = t3 - data.clientTimestamp;
  const serverTime = data.serverSendTime + roundTripDelay / 2;
  const offset = serverTime - t3;
  // 保存 offset 用于后续时间转换
  localServerOffset = offset;
});
```

#### 2. 播放进度补偿算法

```typescript
function calculatePlaybackPosition(syncState: SyncState): number {
  const currentServerTime = Date.now() + localServerOffset;
  const elapsedTime = currentServerTime - syncState.serverTimestamp;
  const expectedPosition = syncState.seekTime + elapsedTime;
  
  const currentPosition = audioPlayer.getCurrentPosition();
  const drift = expectedPosition - currentPosition;
  
  if (Math.abs(drift) > 100) { // 误差 > 100ms
    // 硬同步：淡出 → 跳转 → 淡入（减少用户感知）
    audioPlayer.fadeOut(50); // 50ms 淡出
    setTimeout(() => {
      audioPlayer.seekTo(expectedPosition);
      audioPlayer.fadeIn(50); // 50ms 淡入
    }, 50);
  } else if (Math.abs(drift) > 50) { // 误差 50-100ms
    // 软同步：微调播放速率（± 5% 用户难以察觉）
    const adjustment = Math.min(Math.max(drift * 0.001, -0.05), 0.05);
    audioPlayer.setPlaybackRate(1.0 + adjustment);
  } else {
    // 误差 < 50ms，无需调整
    audioPlayer.setPlaybackRate(1.0);
  }
  
  return expectedPosition;
}
```

#### 3. EQ 滤波器链初始化

```typescript
function initializeEQ(audioContext: AudioContext) {
  const frequencies = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
  const filters = frequencies.map(freq => {
    const filter = audioContext.createBiquadFilter();
    filter.type = 'peaking';
    filter.frequency.value = freq;
    filter.Q.value = 1.0;
    filter.gain.value = 0; // 默认 0dB
    return filter;
  });
  
  // 串联滤波器
  let previousNode = audioContext.source;
  filters.forEach(filter => {
    previousNode.connect(filter);
    previousNode = filter;
  });
  previousNode.connect(audioContext.destination);
  
  return filters;
}
```

### Socket.io 消息协议

| 事件名称 | 方向 | 数据结构 | 说明 |
|---------|------|----------|------|
| `room:create` | C→S | `{ userId, username }` | 创建房间 |
| `room:created` | S→C | `{ roomId, hostId }` | 房间创建成功 |
| `room:join` | C→S | `{ roomId, userId, username }` | 加入房间 |
| `room:joined` | S→C | `{ roomId, members[] }` | 加入成功，返回成员列表 |
| `sync:play` | C→S | `{ trackId, seekTime }` | 请求播放 |
| `sync:state` | S→C | `{ trackId, status, seekTime, serverTimestamp }` | 广播同步状态 |
| `sync:pause` | C→S | `{ seekTime }` | 请求暂停 |
| `sync:seek` | C→S | `{ seekTime }` | 请求跳转进度 |
| `time_sync` | C→S | `{ clientTimestamp }` | 时间同步请求 |
| `time_sync_response` | S→C | `{ clientTimestamp, serverReceiveTime, serverSendTime }` | 时间同步响应 |

## UI/UX 设计指导 (Design Guidelines)

### 界面布局原则（符合章程 II）

1. **主播放页面**:
   - 顶部：房间状态（房间码、在线人数、连接状态指示器）
   - 中部：专辑封面（大尺寸，居中）+ 歌曲信息（歌名、艺术家）
   - 下部：进度条 + 播放控制按钮（播放/暂停、上一首、下一首）
   - 底部：音效按钮（EQ、空间音效）+ 播放列表按钮

2. **EQ 设置页面**:
   - 顶部：预设选择器（横向滑动卡片）
   - 中部：10 个垂直滑块（每个频段），带实时频谱可视化
   - 底部：保存自定义、重置按钮

3. **房间管理页面**:
   - 主界面：创建房间 + 加入房间两个大按钮（明确区分）
   - 加入房间：大号数字输入框（6位房间码），自动聚焦
   - 房间内：成员列表（头像 + 昵称）+ 退出房间按钮

### 配色与样式规范

- **主色调**: 渐变紫蓝（#667eea → #764ba2），体现音乐的动感与科技感
- **背景**: 深色模式 #1a1a2e（默认），浅色模式 #f5f5f5
- **强调色**: 播放按钮使用鲜艳的橙红色 #ff6b6b
- **文字**: 主文本 #ffffff (深色) / #333333 (浅色)，次要文本 70% 透明度
- **圆角**: 按钮 12px，卡片 16px，输入框 8px
- **阴影**: 卡片使用柔和阴影（0 4px 12px rgba(0,0,0,0.1)）

### 交互反馈

- 按钮点击：缩放动画（scale 0.95 → 1.0，150ms）
- 进度条拖动：实时显示时间气泡（HH:MM:SS）
- 加载状态：顶部线性进度条 + 半透明遮罩
- 错误提示：底部 Toast（3秒自动消失），红色背景
- 连接状态：顶部右上角圆点（绿色=已连接，黄色=连接中，红色=断开）

### 操作流程设计

**创建房间并同步播放**:
1. 主界面点击"创建房间" → 2. 显示房间码（大号字体，可复制） → 3. 搜索歌曲 → 4. 点击播放 → 5. 其他成员自动同步

**加入房间流程**:
1. 主界面点击"加入房间" → 2. 输入 6 位数字 → 3. 自动验证并连接 → 4. 进入播放界面（显示当前播放状态）

## 安全性与隐私 (Security & Privacy)

- **房间码安全**: 6 位随机数字，有效期 24 小时，超时自动销毁房间
- **用户匿名**: 完全匿名，无账号系统，使用随机昵称（如"用户1234"）和设备生成的唯一 ID
- **数据隔离**: 房间数据仅在内存中存储，不持久化到服务器数据库
- **本地存储**: 所有用户数据（EQ 设置、播放历史、主题偏好）仅存储在设备本地（AsyncStorage/LocalStorage），不上传到服务器
- **隐私保护**: 服务器不收集或存储任何用户个人信息，仅处理临时房间会话数据
- **API 限流**: 每个 IP 每分钟最多 60 次请求，防止滥用
- **内容安全**: 仅通过网易云音乐官方 API（`neteasecloudmusicapienhanced/api` npm 包）获取音频，不存储音频文件
- **缓存策略**: 歌曲元数据（标题、封面）缓存 24 小时，音频 URL 缓存 2 小时（考虑时效性）

## 测试策略 (Testing Strategy)

### 单元测试（可选，推荐核心逻辑）

- 时间校准算法的偏移量计算准确性
- 播放进度补偿算法在不同误差范围的行为
- EQ 滤波器参数设置与读取

### 集成测试

- Socket.io 连接建立与断开重连流程
- 房间创建、加入、成员管理完整流程
- 播放状态同步（播放/暂停/进度）在多客户端间的一致性

### 端到端测试

- 使用 Detox (React Native) 或 Playwright (Web) 进行自动化 UI 测试
- 验证从搜索到播放的完整用户流程
- 多设备同步播放的音频对齐测试（使用音频分析工具）

### 性能测试

- 使用 Chrome DevTools 分析 Web Audio 节点的 CPU 占用
- 使用 Xcode Instruments 监控 iOS 后台播放的内存和电量消耗
- 压力测试：单房间 50 人同时在线，服务器响应时间和资源占用

## 风险与缓解措施 (Risks & Mitigation)

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| 网易云音乐 API 不稳定或限流 | 高 | 中 | 实现本地缓存层（歌曲信息和音频 URL），智能重试机制（指数退避），API 调用限流保护 |
| 跨平台音频引擎差异导致同步误差 | 高 | 高 | 为每个平台独立校准延迟参数（iOS/Android/Web） |
| Socket.io 在移动端后台被系统杀死 | 中 | 中 | 使用后台任务和推送通知保活，定期重连 |
| Web Audio API 浏览器兼容性问题 | 中 | 低 | 提供降级方案（禁用 EQ），提示用户使用推荐浏览器 |
| HRTF 空间音效计算量大导致卡顿（P4） | 低 | 低 | 使用 AudioWorklet 在独立线程处理，提供"低质量模式"，P4 阶段实现时重点优化 |
| 用户隐私担忧（房间码泄露） | 低 | 低 | 文档说明房间仅临时存在，添加"私密模式"功能 |

## 下一步行动 (Next Steps)

1. **使用 `/speckit.plan` 命令**: 根据本规格文档生成详细的实现计划（plan.md）
2. **Phase 0 研究**: 调研 React Native Track Player 和 Socket.io 集成最佳实践
3. **Phase 1 设计**: 定义数据模型、API 契约、WebSocket 消息格式
4. **Phase 2 任务分解**: 使用 `/speckit.tasks` 生成按用户故事组织的任务清单

---

**文档版本**: 1.0.0  
**作者**: GitHub Copilot  
**审核状态**: 待审核  
**估算工作量**: 6-8 周（2 名全职开发者）
