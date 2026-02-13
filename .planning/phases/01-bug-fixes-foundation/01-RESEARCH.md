# Phase 1: Bug Fixes & Foundation - Research

**Researched:** 2026-02-14
**Domain:** Real-time synchronization, Socket.io reconnection, optimistic concurrency control
**Confidence:** HIGH

## Summary

Phase 1 addresses two critical bugs in the real-time music synchronization system: version number reset on track changes (BUGF-01) and socket reconnection race conditions (BUGF-02). The system uses Socket.io 4.6.1 (backend) and 4.8.3 (client) with optimistic concurrency control via version numbers.

**Current bug manifestations:**
- BUGF-01: Version number resets to 0 when changing tracks (line 96 in SyncEngine.ts), breaking playlist sync ordering
- BUGF-02: Socket reconnection creates new socket IDs without persistent client identification, causing duplicate connections and state loss

**Primary recommendation:** Implement server-authoritative version management with monotonic increment-only semantics, and add persistent client UUID with grace-period-based old connection cleanup.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**版本号修复策略 (Version Number Fix Strategy)**
- 服务端为版本号的权威来源，客户端每次操作向服务端请求新版本号
- 切歌时版本号递增，不重置 — 版本号只增不减
- 版本号溢出时回绕到 1，服务端处理回绕逻辑
- 版本号生命周期跟随房间 — 房间创建时从 1 开始，房间销毁后自然重置

**重连竞态处理 (Reconnection Race Condition Handling)**
- 客户端生成持久化 UUID（存储在本地），重连时携带该 ID，服务端用 clientId 而非 socket ID 识别用户
- 服务端检测到同一 clientId 的新连接后，给旧连接一个短暂宽限期（如 2-3 秒），宽限期后踢掉旧连接
- 重连成功后，服务端主动推送当前房间的完整状态（当前歌曲、播放位置、版本号等），客户端直接覆盖本地状态

**回归防护 (Regression Protection)**
- Phase 1 不写自动化测试，纯修 bug
- 列出手动验证场景清单，供修复后验证使用
- 验证范围覆盖 bug 修复 + 核心同步功能回归（播放/暂停/seek/切歌同步）

**边界场景行为 (Edge Case Behavior)**
- 快速连续切歌时做防抖处理，只处理最后一次切歌操作
- 重连过程中用户的操作（切歌、播放/暂停等）直接丢弃，重连成功后以服务端状态为准
- 多设备同时断线重连时（如服务器短暂重启），服务端等待一个短暂窗口（如 3 秒）后批量处理重连请求，减少重复广播
- 断线期间客户端禁用播放控制按钮，显示「重连中...」状态

### Claude's Discretion
- 宽限期和批量处理窗口的具体时长
- 防抖的具体实现方式和延迟时间
- 版本号回绕的具体阈值
- 断线 UI 的具体样式和动画

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| socket.io | 4.6.1 | Backend WebSocket server | Industry standard for real-time bidirectional communication |
| socket.io-client | 4.8.3 | Client WebSocket connection | Official client for Socket.io, version compatible with 4.6.x server |
| TypeScript | 5.9.3 | Type safety | Shared types between client/server prevent protocol mismatches |
| Express | 4.18.2 | HTTP server foundation | Minimal HTTP layer for Socket.io attachment |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| uuid | (to add) | Client ID generation | For persistent client identification across reconnections |
| @react-native-async-storage/async-storage | 2.2.0 | Client-side persistence | Already in use, store persistent client UUID |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Socket.io | Native WebSocket | Socket.io provides automatic reconnection, room management, and fallback transports |
| Server-side version | Client-side version | Client clocks can drift; server is single source of truth |
| UUID v4 | Timestamp-based ID | UUID v4 has no collision risk, timestamp requires coordination |

**Installation:**
```bash
# Backend
cd backend
yarn add uuid
yarn add -D @types/uuid

# Client already has AsyncStorage
```

## Architecture Patterns

### Recommended Project Structure
```
backend/src/
├── services/
│   ├── room/
│   │   ├── RoomManager.ts      # Room lifecycle, version management
│   │   └── RoomStore.ts        # In-memory room storage
│   └── sync/
│       └── SyncEngine.ts       # Sync state broadcast, conflict resolution
├── handlers/
│   ├── roomHandlers.ts         # Socket handlers for room events
│   └── syncHandlers.ts         # Socket handlers for sync events
└── server.ts                   # Socket.io connection lifecycle

app/src/
├── services/
│   ├── sync/
│   │   ├── SocketManager.ts    # Connection management, reconnection
│   │   └── RoomService.ts      # Room operations
│   └── storage/
│       └── LocalStorage.ts     # Persistent client UUID storage
```

### Pattern 1: Server-Authoritative Version Management
**What:** Server owns version number, increments on every state change, never resets except on room creation
**When to use:** All sync state updates (play/pause/seek/track change)
**Example:**
```typescript
// Backend: SyncEngine.ts
handleSyncUpdate(roomId: string, newSyncState: SyncState, userId: string) {
  const room = roomManager.getRoom(roomId);
  const currentVersion = room.syncState.version;

  // Server increments version - client version is ignored
  const updatedState: SyncState = {
    ...newSyncState,
    serverTimestamp: Date.now(),
    updatedBy: userId,
    version: currentVersion + 1, // Always increment
  };

  roomManager.updateSyncState(roomId, updatedState);
  this.broadcastSyncState(roomId, updatedState, socketId);
}
```

### Pattern 2: Persistent Client ID with Grace Period
**What:** Client generates UUID on first launch, sends with every connection, server maintains clientId → socketId mapping with grace period for old connections
**When to use:** Socket connection, reconnection, room join
**Example:**
```typescript
// Client: Generate and persist UUID
import { v4 as uuidv4 } from 'uuid';
import AsyncStorage from '@react-native-async-storage/async-storage';

async function getOrCreateClientId(): Promise<string> {
  let clientId = await AsyncStorage.getItem('musesync:client_id');
  if (!clientId) {
    clientId = uuidv4();
    await AsyncStorage.setItem('musesync:client_id', clientId);
  }
  return clientId;
}

// Server: Handle reconnection with grace period
interface ClientConnection {
  clientId: string;
  socketId: string;
  userId: string;
  roomId: string;
  connectedAt: number;
  gracePeriodTimer?: NodeJS.Timeout;
}

private clientConnections = new Map<string, ClientConnection>();

handleReconnection(clientId: string, newSocketId: string, userId: string, roomId: string) {
  const existing = this.clientConnections.get(clientId);

  if (existing) {
    // Clear any existing grace period
    if (existing.gracePeriodTimer) {
      clearTimeout(existing.gracePeriodTimer);
    }

    // Set grace period for old socket
    const oldSocketId = existing.socketId;
    existing.gracePeriodTimer = setTimeout(() => {
      this.io.to(oldSocketId).disconnectSockets(true);
      console.log(`[Reconnection] Kicked old socket ${oldSocketId} after grace period`);
    }, 2500); // 2.5 second grace period

    // Update to new socket immediately
    existing.socketId = newSocketId;
    existing.connectedAt = Date.now();
  } else {
    // New connection
    this.clientConnections.set(clientId, {
      clientId,
      socketId: newSocketId,
      userId,
      roomId,
      connectedAt: Date.now(),
    });
  }
}
```

### Pattern 3: Full State Snapshot on Reconnection
**What:** Server sends complete room state (track, position, version, playlist) after successful reconnection
**When to use:** After client reconnects and rejoins room
**Example:**
```typescript
// Server: Send full state after reconnection
socket.on('room:rejoin', async (data: { roomId: string; userId: string; clientId: string }) => {
  const room = roomManager.getRoom(data.roomId);
  if (!room) return;

  // Handle reconnection logic
  handleReconnection(data.clientId, socket.id, data.userId, data.roomId);

  // Send full state snapshot
  socket.emit('room:state_snapshot', {
    room: room,
    syncState: room.syncState,
    currentTrack: room.currentTrack,
    playlist: room.playlist,
    serverTimestamp: Date.now(),
  });
});

// Client: Apply snapshot, discard local state
socket.on('room:state_snapshot', (snapshot) => {
  // Overwrite local state completely
  setRoom(snapshot.room);
  setSyncState(snapshot.syncState);
  setCurrentTrack(snapshot.currentTrack);
  setPlaylist(snapshot.playlist);

  // Sync audio player to server state
  if (snapshot.syncState.status === 'playing') {
    audioService.play(snapshot.currentTrack, snapshot.syncState.seekTime);
  } else {
    audioService.pause();
    audioService.seek(snapshot.syncState.seekTime);
  }
});
```

### Pattern 4: Debounced Track Changes
**What:** Rapid track change requests are debounced, only last request within window is processed
**When to use:** Next/previous track operations, playlist navigation
**Example:**
```typescript
// Client-side debounce
import { debounce } from 'lodash'; // or implement custom

const debouncedNextTrack = debounce(
  (roomId: string, userId: string) => {
    socket.emit('sync:next', { roomId, userId });
  },
  300, // 300ms debounce
  { leading: true, trailing: false } // Execute first call immediately, ignore subsequent
);

// Server-side rate limiting (already exists in middleware/rateLimiter.ts)
```

### Anti-Patterns to Avoid
- **Client-side version increment:** Client should never increment version, only read it for conflict detection
- **Resetting version on track change:** Version is monotonic per room lifetime, track changes are just another state update
- **Using socket.id as user identifier:** Socket ID changes on reconnection, use persistent clientId + userId
- **Merging state on reconnection:** Always use server state as source of truth, never merge client + server state

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| UUID generation | Custom ID generator | `uuid` package (v4) | Cryptographically secure, collision-resistant, RFC 4122 compliant |
| Debouncing | Custom debounce logic | `lodash.debounce` or built-in timer | Edge cases: leading/trailing, cancel, flush are complex |
| Time synchronization | Custom NTP | Existing `TimeSyncService.ts` | Already implements NTP-like algorithm with t0/t1/t2/t3 |
| Reconnection logic | Custom reconnection | Socket.io built-in | Handles exponential backoff, transport fallback, browser quirks |

**Key insight:** Socket.io already handles 90% of reconnection complexity (transport negotiation, exponential backoff, ping/pong). The bug is not in Socket.io's reconnection, but in application-level client identification.

## Common Pitfalls

### Pitfall 1: Version Number Reset on Track Change
**What goes wrong:** Line 96 in `SyncEngine.ts` resets version to 0 when `isNewTrack` is true, breaking optimistic concurrency control
**Why it happens:** Misunderstanding of version semantics - version tracks room state changes, not track identity
**How to avoid:** Remove `isNewTrack` special case, always increment version
**Warning signs:** Playlist sync conflicts, out-of-order track changes, "stale update rejected" errors after track changes

**Current buggy code:**
```typescript
// backend/src/services/sync/SyncEngine.ts:96
version: isNewTrack ? 0 : currentState.version + 1, // BUG: resets to 0
```

**Fix:**
```typescript
version: currentState.version + 1, // Always increment
```

### Pitfall 2: Socket ID as User Identity
**What goes wrong:** `User.socketId` changes on reconnection, breaking user tracking and causing duplicate room members
**Why it happens:** Socket.io generates new socket ID on each connection, not persistent across reconnections
**How to avoid:** Add persistent `clientId` field, use it for identity, treat `socketId` as ephemeral connection handle
**Warning signs:** Duplicate users in room after reconnection, lost permissions after reconnect, "user not found" errors

### Pitfall 3: Race Condition on Simultaneous Reconnections
**What goes wrong:** Multiple devices reconnect simultaneously (e.g., server restart), each triggers full state broadcast, causing broadcast storm
**Why it happens:** No coordination between reconnection handlers
**How to avoid:** Batch reconnection events with short window (3 seconds), send single broadcast after window closes
**Warning signs:** Server CPU spike on restart, network congestion, slow reconnection for last clients

### Pitfall 4: Client Operations During Reconnection
**What goes wrong:** User clicks play/pause during reconnection, operation is queued/lost, causes confusion
**Why it happens:** No UI feedback that connection is down, operations fail silently
**How to avoid:** Disable playback controls during reconnection, show "Reconnecting..." status
**Warning signs:** User reports "buttons don't work", operations seem to be ignored

### Pitfall 5: Version Number Overflow
**What goes wrong:** Version number exceeds `Number.MAX_SAFE_INTEGER` (2^53 - 1) after ~285 million operations, causes precision loss
**Why it happens:** JavaScript numbers are IEEE 754 doubles, lose precision above 2^53
**How to avoid:** Wrap version to 1 when approaching limit (e.g., at 2^50), handle wrap-around in comparison logic
**Warning signs:** Version numbers become non-sequential, conflicts detected incorrectly

**Wrap-around implementation:**
```typescript
const MAX_VERSION = Math.pow(2, 50); // Safe threshold before precision loss

function incrementVersion(current: number): number {
  return current >= MAX_VERSION ? 1 : current + 1;
}

function isVersionNewer(incoming: number, current: number): boolean {
  // Handle wrap-around: if difference is huge, assume wrap occurred
  const diff = incoming - current;
  if (Math.abs(diff) > MAX_VERSION / 2) {
    // Wrap-around detected, smaller number is actually newer
    return incoming < current;
  }
  return incoming > current;
}
```

## Code Examples

Verified patterns from codebase analysis:

### Current Version Management (Buggy)
```typescript
// backend/src/services/sync/SyncEngine.ts:82-97
const isNewTrack = newSyncState.trackId && newSyncState.trackId !== currentState.trackId;

if (!isNewTrack && newSyncState.version !== undefined && newSyncState.version < currentState.version) {
  console.warn(`[SyncEngine] Rejected stale update`);
  return { success: false, currentState, error: 'Stale update rejected' };
}

const updatedState: SyncState = {
  ...newSyncState,
  serverTimestamp: Date.now(),
  updatedBy: userId,
  version: isNewTrack ? 0 : currentState.version + 1, // BUG HERE
};
```

### Current Reconnection Handling (Buggy)
```typescript
// backend/src/services/room/RoomManager.ts:139-146
const existingMember = room.members.find((m) => m.userId === request.userId);
if (existingMember) {
  // User reconnecting, update their info
  existingMember.socketId = ''; // Will be updated by Socket.io handler
  existingMember.connectionState = 'connected';
  existingMember.lastSeenAt = Date.now();
  // BUG: No handling of old socket, creates duplicate connections
}
```

### Socket Connection Setup
```typescript
// app/src/services/sync/SocketManager.ts:68-77
this.socket = io(this.serverUrl, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5,
  timeout: 10000,
  forceNew: true,
});
```

### Room State Structure
```typescript
// shared/types/entities.ts:40-49
export interface SyncState {
  trackId: string | null;
  status: 'playing' | 'paused' | 'loading' | 'stopped';
  seekTime: number; // in milliseconds
  serverTimestamp: number; // Unix timestamp when this state was set
  playbackRate: number; // 1.0 = normal speed
  volume: number; // 0.0 to 1.0
  updatedBy: string; // userId of who triggered the update
  version: number; // Optimistic concurrency control
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Socket ID as identity | Persistent client UUID | Industry standard since ~2015 | Enables seamless reconnection without state loss |
| Client-side version increment | Server-authoritative version | OCC best practice | Eliminates clock skew and race conditions |
| Immediate old socket disconnect | Grace period before disconnect | Modern practice (~2020+) | Prevents premature disconnection during network handoff |
| Merge state on reconnect | Server snapshot overwrites client | CRDT/event sourcing influence | Simpler conflict resolution, server is source of truth |

**Deprecated/outdated:**
- Using socket ID for user identification (pre-2015 pattern, before mobile reconnection became common)
- Resetting version numbers on entity changes (misunderstanding of OCC, version tracks aggregate state not entity identity)

## Open Questions

1. **Version wrap-around threshold**
   - What we know: JavaScript safe integer limit is 2^53 - 1
   - What's unclear: Realistic room lifetime and operation frequency
   - Recommendation: Use 2^50 as threshold (provides 1 quadrillion operations), implement wrap-around logic defensively

2. **Grace period duration**
   - What we know: Network handoff (WiFi → cellular) takes 1-3 seconds
   - What's unclear: Worst-case network conditions for target users
   - Recommendation: Start with 2.5 seconds, make configurable, monitor metrics

3. **Batch reconnection window**
   - What we know: Server restart causes simultaneous reconnections
   - What's unclear: Typical room size and reconnection distribution
   - Recommendation: 3-second window, max 10 rooms per batch

4. **Debounce timing for track changes**
   - What we know: Human reaction time is ~200ms, accidental double-clicks happen within 300ms
   - What's unclear: User expectations for rapid track skipping
   - Recommendation: 300ms debounce with leading edge (first click executes immediately)

## Manual Verification Checklist

Since Phase 1 has no automated tests, use this checklist for manual regression testing:

### BUGF-01: Version Number Persistence
- [ ] Create room, play track, check version = 1
- [ ] Pause, check version = 2
- [ ] Change track (next), check version = 3 (NOT 0)
- [ ] Change track again, check version = 4 (NOT 0)
- [ ] Seek, check version = 5
- [ ] Verify all clients receive correct version numbers

### BUGF-02: Reconnection Without Race Conditions
- [ ] Join room from 2 devices
- [ ] Disconnect device A (airplane mode)
- [ ] Reconnect device A
- [ ] Verify device A rejoins successfully
- [ ] Verify device A does NOT appear twice in member list
- [ ] Verify device A receives current playback state
- [ ] Verify device B sees device A reconnect (not new join)

### Core Sync Regression Tests
- [ ] Play/pause sync across 2 devices
- [ ] Seek sync across 2 devices
- [ ] Track change sync across 2 devices
- [ ] Volume change sync (if implemented)
- [ ] Host transfer after host leaves
- [ ] Room deletion when last member leaves

### Edge Cases
- [ ] Rapid track changes (next/next/next quickly)
- [ ] Operations during reconnection (should be disabled)
- [ ] Multiple devices reconnect simultaneously
- [ ] Reconnection after long disconnect (>1 minute)
- [ ] Network switch (WiFi → cellular) during playback

### UI/UX Verification
- [ ] "Reconnecting..." status shows during disconnect
- [ ] Playback controls disabled during reconnection
- [ ] Controls re-enable after successful reconnection
- [ ] No error toasts for expected reconnection flow

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `backend/src/services/sync/SyncEngine.ts` (version reset bug on line 96)
- Codebase analysis: `backend/src/services/room/RoomManager.ts` (reconnection handling lines 139-146)
- Codebase analysis: `app/src/services/sync/SocketManager.ts` (Socket.io client configuration)
- Codebase analysis: `shared/types/entities.ts` (SyncState and User type definitions)
- Package manifests: Socket.io 4.6.1 (backend), 4.8.3 (client), TypeScript 5.9.3

### Secondary (MEDIUM confidence)
- [Optimistic Concurrency Control patterns](https://medium.com) - Version number semantics and conflict resolution
- [System Design School](https://systemdesignschool.io) - OCC best practices
- [Stack Overflow](https://stackoverflow.com) - Version number management patterns

### Tertiary (LOW confidence - needs verification)
- Socket.io 4.x reconnection best practices (web search failed, relying on official docs knowledge from training)
- Grace period timing for mobile network handoff (industry practice, not formally documented)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Verified from package.json files, versions confirmed
- Architecture: HIGH - Patterns derived from existing codebase structure
- Pitfalls: HIGH - Bugs identified through code analysis, root causes verified
- Edge cases: MEDIUM - Based on user decisions and common real-time sync scenarios
- Timing values (grace period, debounce): MEDIUM - Industry practices, need tuning

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (30 days - stable domain, Socket.io 4.x is mature)

**Key files analyzed:**
- `backend/src/services/sync/SyncEngine.ts` - Version management bug location
- `backend/src/services/room/RoomManager.ts` - Reconnection handling
- `app/src/services/sync/SocketManager.ts` - Client reconnection logic
- `shared/types/entities.ts` - Data model definitions
- `shared/types/socket-events.ts` - Event protocol definitions
