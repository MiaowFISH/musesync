# Data Model: 多设备实时同步音乐播放器

**Feature**: 001-realtime-sync-player  
**Date**: 2026-01-02  
**Source**: Extracted from [spec.md](spec.md#核心实体-key-entities)

## Entities

### Room (房间)

房间是多设备同步播放的核心实体，管理成员连接、播放列表和同步状态。

**Fields**:
- `roomId: string` - 6位唯一数字房间码（如 "123456"）
- `hostId: string` - 房间创建者的 userId
- `members: User[]` - 当前房间内的所有成员列表
- `playlist: Track[]` - 共享播放列表（按添加顺序）
- `currentTrack: Track | null` - 当前正在播放的曲目
- `currentTrackIndex: number` - 当前曲目在 playlist 中的索引
- `syncState: SyncState` - 播放同步状态对象
- `controlMode: 'open' | 'host-only'` - 控制模式（开放协作 | 仅主持人）
- `createdAt: number` - 房间创建时间戳（Unix 毫秒）
- `lastActivityAt: number` - 最后活动时间戳（用于清理过期房间）

**Relationships**:
- One-to-Many with `User` (一个房间多个成员)
- One-to-Many with `Track` (一个房间多首歌曲)
- One-to-One with `SyncState` (一个房间一个同步状态)

**Validation Rules**:
- `roomId` must be exactly 6 digits (000000-999999), unique across all active rooms
- `members` maximum length: 50 (NFR requirement)
- `controlMode` must be either 'open' or 'host-only'
- `hostId` must exist in `members` list
- `currentTrackIndex` must be >= -1 and < `playlist.length` (-1 means no track playing)

**State Transitions**:
```
CREATED (empty members) 
  → ACTIVE (members > 0)
  → EXPIRED (lastActivityAt > 24 hours ago)
  → DELETED
```

**Storage**: Server-side in-memory (optional Redis cache), ephemeral (24-hour TTL)

---

### Track (曲目)

曲目实体代表一首可播放的音乐，包含元数据和音频资源 URL。

**Fields**:
- `trackId: string` - 网易云音乐歌曲 ID（如 "33894312"）
- `title: string` - 歌曲标题
- `artist: string` - 艺术家名称（多艺术家用 "/" 分隔）
- `album: string` - 专辑名称
- `coverUrl: string` - 专辑封面图片 URL (HTTPS)
- `audioUrl: string` - 音频流 URL (HTTPS, 20分钟有效期)
- `audioUrlExpiry: number` - audioUrl 过期时间戳（Unix 毫秒）
- `duration: number` - 歌曲总时长（毫秒）
- `quality: 'standard' | 'higher' | 'exhigh' | 'lossless'` - 音频质量等级
- `addedBy: string` - 添加此曲目的用户 userId（可选）
- `addedAt: number` - 添加时间戳（Unix 毫秒）

**Relationships**:
- Many-to-One with `Room` (多首歌曲属于一个房间)
- Referenced by `SyncState.trackId`

**Validation Rules**:
- `trackId` must be non-empty string
- `duration` must be > 0
- `audioUrl` must be valid HTTPS URL
- `audioUrlExpiry` must be in the future (otherwise needs refresh)
- `quality` must be one of the defined levels

**Business Logic**:
- `audioUrl` expires after ~20 minutes, client must call refresh API when `Date.now() >= audioUrlExpiry - 5*60*1000` (5分钟提前刷新)
- `coverUrl` cached for 24 hours (HTTP cache headers)

**Storage**: 
- Server: Temporary in Room object (memory)
- Client: Metadata cached in AsyncStorage/LocalStorage for 24 hours
- Audio URL cached for 20 minutes

---

### SyncState (同步状态)

同步状态对象包含播放器的实时状态，用于多设备间的状态同步。

**Fields**:
- `trackId: string | null` - 当前播放曲目的 ID（null 表示未播放）
- `status: 'playing' | 'paused' | 'loading' | 'stopped'` - 播放状态
- `seekTime: number` - 播放位置（毫秒，相对于曲目开始）
- `serverTimestamp: number` - 服务器时间戳（Unix 毫秒，用于客户端计算期望播放位置）
- `playbackRate: number` - 播放速率（1.0 为正常，0.95-1.05 用于软同步）
- `volume: number` - 音量（0.0-1.0，仅用于房间级别静音控制，不影响设备本地音量）
- `updatedBy: string` - 最后更新状态的用户 userId
- `version: number` - 状态版本号（递增，用于解决并发冲突）

**Relationships**:
- One-to-One with `Room` (一个房间一个同步状态)
- References `Track` by `trackId`

**Validation Rules**:
- `status` must be one of the defined states
- `seekTime` must be >= 0 and <= Track.duration
- `playbackRate` must be between 0.8 and 1.2 (实际同步仅使用 0.95-1.05)
- `volume` must be between 0.0 and 1.0
- `version` must be monotonically increasing

**State Transitions**:
```
stopped → loading → playing
playing → paused → playing
playing → loading (track change) → playing
paused → stopped
```

**Conflict Resolution**:
- Last-Write-Wins (LWW) based on `serverTimestamp`
- If `version` numbers conflict (rare), higher version wins
- Client maintains local queue of state changes, applies optimistic updates

**Storage**: Server-side in-memory as part of Room object

---

### User (用户)

用户实体代表一个连接到房间的设备/客户端（完全匿名，无账号系统）。

**Fields**:
- `userId: string` - 设备生成的唯一 ID（UUID v4）
- `username: string` - 显示名称（随机生成如"用户1234"或用户自定义）
- `deviceId: string` - 设备唯一标识（平台生成）
- `deviceType: 'ios' | 'android' | 'web'` - 设备类型
- `socketId: string` - Socket.io 连接 ID（用于消息路由）
- `connectionState: 'connected' | 'reconnecting' | 'disconnected'` - 连接状态
- `joinedAt: number` - 加入房间时间戳（Unix 毫秒）
- `lastSeenAt: number` - 最后活跃时间戳（心跳更新）
- `latency: number` - 客户端到服务器的往返延迟（毫秒，用于同步计算）
- `timeOffset: number` - 客户端时钟与服务器时钟的偏移量（毫秒）

**Relationships**:
- Many-to-One with `Room` (多个用户属于一个房间)

**Validation Rules**:
- `userId` must be valid UUID v4
- `username` length must be 1-20 characters
- `deviceType` must be one of the defined types
- `latency` should be < 1000ms for acceptable sync quality
- `timeOffset` recalculated every 30 seconds using NTP-like algorithm

**Lifecycle**:
- Created when user joins room (room:join event)
- `lastSeenAt` updated on every Socket.io message (heartbeat)
- Marked as 'disconnected' if no heartbeat for 60 seconds
- Removed from room after 5 minutes of disconnection

**Storage**: 
- Server: In-memory as part of Room.members array
- Client: Local only (AsyncStorage/LocalStorage for userId persistence)

---

### EQPreset (均衡器预设)

EQ 预设存储用户的音效配置，包括系统预设和自定义预设。

**Fields**:
- `presetId: string` - 预设唯一 ID（UUID v4 或预定义如 "builtin-rock"）
- `name: string` - 预设名称（如 "摇滚", "我的调音"）
- `bands: number[]` - 10个频段的增益值数组，范围 -12.0 至 +12.0 (dB)
- `isBuiltIn: boolean` - 是否为系统内置预设（不可修改/删除）
- `createdAt: number` - 创建时间戳（Unix 毫秒）
- `updatedAt: number` - 最后修改时间戳（Unix 毫秒）

**Relationships**:
- Standalone entity, no server-side relationships (local only)

**Validation Rules**:
- `name` length must be 1-30 characters
- `bands` array must have exactly 10 elements
- Each `bands[i]` must be between -12.0 and +12.0
- Built-in presets cannot be modified or deleted (UI enforcement)

**Built-in Presets** (defined in constants):
```typescript
{
  'builtin-pop': { name: '流行', bands: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  'builtin-rock': { name: '摇滚', bands: [5, 3, 0, -2, -3, 1, 2, 3, 4, 4] },
  'builtin-classical': { name: '古典', bands: [0, 0, 0, 0, 0, 0, -2, -2, -2, -3] },
  'builtin-vocal': { name: '人声', bands: [-3, -2, 0, 2, 4, 4, 3, 1, 0, -1] },
  'builtin-electronic': { name: '电子', bands: [6, 4, 0, -2, 2, 0, 1, 4, 5, 6] }
}
```

**Storage**: Client-side only (AsyncStorage/LocalStorage), no server sync

---

### LocalPreferences (本地偏好设置)

本地偏好设置存储用户的应用配置（主题、播放历史等）。

**Fields**:
- `theme: 'dark' | 'light' | 'system'` - 主题模式
- `currentEQPresetId: string | null` - 当前激活的 EQ 预设 ID
- `eqEnabled: boolean` - EQ 是否启用
- `customEQPresets: EQPreset[]` - 用户自定义 EQ 预设列表
- `playbackHistory: Track[]` - 播放历史（最多 100 首，FIFO）
- `recentRooms: { roomId: string, joinedAt: number }[]` - 最近加入的房间列表（最多 10 个）
- `username: string` - 用户自定义昵称（为空则使用随机昵称）
- `audioQualityPreference: 'auto' | 'standard' | 'higher' | 'exhigh' | 'lossless'` - 音质偏好

**Relationships**:
- Standalone entity, local storage only

**Validation Rules**:
- `playbackHistory` max length: 100
- `recentRooms` max length: 10
- `customEQPresets` max length: 20 (prevent excessive storage)
- `username` length: 0-20 characters

**Business Logic**:
- `playbackHistory` uses FIFO queue (oldest removed when > 100)
- `recentRooms` sorted by `joinedAt` descending
- `audioQualityPreference = 'auto'` adapts based on network type (wifi → lossless, 4G → exhigh, 3G → higher)

**Storage**: Client-side only (AsyncStorage/LocalStorage)

---

## Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────┐
│                         Server                          │
│                                                         │
│  ┌─────────────────┐                                   │
│  │      Room       │                                   │
│  ├─────────────────┤                                   │
│  │ roomId (PK)     │                                   │
│  │ hostId          │───┐                               │
│  │ controlMode     │   │                               │
│  │ createdAt       │   │                               │
│  └─────────────────┘   │                               │
│          │             │                               │
│          │ 1:N         │                               │
│          ▼             │                               │
│  ┌─────────────────┐   │                               │
│  │      User       │   │                               │
│  ├─────────────────┤   │                               │
│  │ userId (PK)     │◄──┘ (hostId reference)            │
│  │ username        │                                   │
│  │ socketId        │                                   │
│  │ deviceType      │                                   │
│  │ connectionState │                                   │
│  │ timeOffset      │                                   │
│  └─────────────────┘                                   │
│                                                         │
│  ┌─────────────────┐         ┌─────────────────┐      │
│  │      Room       │────1:N──│     Track       │      │
│  │   (playlist)    │         │                 │      │
│  └─────────────────┘         ├─────────────────┤      │
│          │                    │ trackId (PK)    │      │
│          │ 1:1                │ title, artist   │      │
│          ▼                    │ audioUrl        │      │
│  ┌─────────────────┐         │ audioUrlExpiry  │      │
│  │   SyncState     │──ref──► │ duration        │      │
│  ├─────────────────┤         └─────────────────┘      │
│  │ trackId (FK)    │                                   │
│  │ status          │                                   │
│  │ seekTime        │                                   │
│  │ serverTimestamp │                                   │
│  │ playbackRate    │                                   │
│  │ version         │                                   │
│  └─────────────────┘                                   │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                         Client                          │
│                       (Local Storage)                   │
│                                                         │
│  ┌─────────────────────┐                               │
│  │  LocalPreferences   │                               │
│  ├─────────────────────┤                               │
│  │ theme               │                               │
│  │ currentEQPresetId   │──ref──┐                       │
│  │ eqEnabled           │       │                       │
│  │ playbackHistory     │◄──┐   │                       │
│  │ recentRooms         │   │   │                       │
│  │ username            │   │   │                       │
│  └─────────────────────┘   │   │                       │
│                            │   │                       │
│  ┌─────────────────┐       │   │                       │
│  │     Track       │───────┘   │                       │
│  │  (from history) │           │                       │
│  └─────────────────┘           │                       │
│                                │                       │
│  ┌─────────────────┐           │                       │
│  │   EQPreset      │◄──────────┘                       │
│  ├─────────────────┤                                   │
│  │ presetId (PK)   │                                   │
│  │ name            │                                   │
│  │ bands[10]       │                                   │
│  │ isBuiltIn       │                                   │
│  └─────────────────┘                                   │
│         ▲                                              │
│         │ 1:N                                          │
│         │                                              │
│  ┌─────────────────────┐                               │
│  │  LocalPreferences   │                               │
│  │ (customEQPresets[]) │                               │
│  └─────────────────────┘                               │
└─────────────────────────────────────────────────────────┘
```

## TypeScript Type Definitions

Complete type definitions will be placed in `shared/types/` for use by both frontend and backend:

```typescript
// shared/types/entities.ts

export interface Room {
  roomId: string; // 6-digit code
  hostId: string;
  members: User[];
  playlist: Track[];
  currentTrack: Track | null;
  currentTrackIndex: number;
  syncState: SyncState;
  controlMode: 'open' | 'host-only';
  createdAt: number;
  lastActivityAt: number;
}

export interface Track {
  trackId: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  audioUrl: string;
  audioUrlExpiry: number;
  duration: number;
  quality: 'standard' | 'higher' | 'exhigh' | 'lossless';
  addedBy?: string;
  addedAt: number;
}

export interface SyncState {
  trackId: string | null;
  status: 'playing' | 'paused' | 'loading' | 'stopped';
  seekTime: number;
  serverTimestamp: number;
  playbackRate: number;
  volume: number;
  updatedBy: string;
  version: number;
}

export interface User {
  userId: string;
  username: string;
  deviceId: string;
  deviceType: 'ios' | 'android' | 'web';
  socketId: string;
  connectionState: 'connected' | 'reconnecting' | 'disconnected';
  joinedAt: number;
  lastSeenAt: number;
  latency: number;
  timeOffset: number;
}

export interface EQPreset {
  presetId: string;
  name: string;
  bands: number[]; // length 10, range -12 to +12
  isBuiltIn: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface LocalPreferences {
  theme: 'dark' | 'light' | 'system';
  currentEQPresetId: string | null;
  eqEnabled: boolean;
  customEQPresets: EQPreset[];
  playbackHistory: Track[];
  recentRooms: { roomId: string; joinedAt: number }[];
  username: string;
  audioQualityPreference: 'auto' | 'standard' | 'higher' | 'exhigh' | 'lossless';
}
```

## Data Flow Scenarios

### Scenario 1: User A creates room and plays track

1. **Client A** → Server: `room:create` event with `{ userId, username }`
2. **Server** creates `Room` object with generated `roomId`, adds User A to `members[]`, emits `room:created`
3. **Client A** searches for track, receives `Track` object from NetEase API
4. **Client A** → Server: `sync:play` event with `{ trackId, seekTime: 0 }`
5. **Server** updates `room.syncState` with `{ trackId, status: 'playing', seekTime: 0, serverTimestamp: Date.now() }`
6. **Server** → All clients: broadcasts `sync:state` event
7. **Client A** starts playback with React Native Track Player

### Scenario 2: User B joins room and syncs playback

1. **Client B** → Server: `room:join` event with `{ roomId, userId, username }`
2. **Server** validates `roomId`, adds User B to `room.members[]`, emits `room:joined` with current `members[]` and `syncState`
3. **Client B** receives current `syncState`, calculates expected playback position:
   ```
   elapsedTime = (currentServerTime - syncState.serverTimestamp)
   expectedPosition = syncState.seekTime + elapsedTime
   ```
4. **Client B** loads track from `syncState.trackId`, seeks to `expectedPosition`, starts playback
5. **Client B** starts drift monitoring loop (every 100ms), applies soft/hard sync as needed

### Scenario 3: Audio URL expires during playback

1. **Client** detects `Date.now() >= track.audioUrlExpiry - 5*60*1000` (5 minutes before expiry)
2. **Client** → NetEase API: requests fresh audio URL with `GET /song/url/v1?id={trackId}&level={quality}`
3. **NetEase API** returns new `audioUrl` with updated `audioUrlExpiry`
4. **Client** updates local `Track` object with new URL (in memory and cache)
5. **Client** seamlessly transitions to new URL (React Native Track Player supports URL replacement without interrupting playback)

---

**Version**: 1.0.0  
**Generated**: 2026-01-02  
**Next**: Define API contracts in [contracts/](contracts/)
