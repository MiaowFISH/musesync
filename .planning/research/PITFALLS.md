# Domain Pitfalls: Real-Time Sync Music Player

**Domain:** Real-time synchronized music playback (multi-client)
**Researched:** 2026-02-14
**Confidence:** MEDIUM (based on codebase analysis + training data, no external verification available)

## Critical Pitfalls

Mistakes that cause rewrites or major issues.

### Pitfall 1: Drift Compensation Fighting Audio Engine
**What goes wrong:** Implementing drift compensation that constantly seeks/adjusts playback creates audio glitches, buffer underruns, and worse sync than doing nothing.

**Why it happens:**
- Treating drift compensation like video sync (aggressive corrections)
- Not accounting for audio buffer latency (50-200ms typical)
- Correcting drift more frequently than buffer refill cycles
- Using `seekTo()` for small corrections instead of playback rate adjustment

**Consequences:**
- Audible clicks, pops, or stuttering every few seconds
- Users disable sync feature or abandon app
- Battery drain from constant audio engine resets
- React Native Track Player buffer state corruption

**Prevention:**
```typescript
// BAD: Aggressive seeking causes glitches
if (Math.abs(drift) > 0.1) {  // 100ms threshold too tight
  await TrackPlayer.seekTo(targetPosition);
}

// GOOD: Tiered correction strategy
if (Math.abs(drift) > 3.0) {
  // Hard correction for major drift
  await TrackPlayer.seekTo(targetPosition);
} else if (Math.abs(drift) > 0.5) {
  // Soft correction via playback rate (1.0 ± 0.05)
  await TrackPlayer.setRate(drift > 0 ? 1.05 : 0.95);
  setTimeout(() => TrackPlayer.setRate(1.0), 2000);
} else {
  // Ignore minor drift (< 500ms)
}
```

**Detection:**
- Users report "choppy" or "stuttering" playback
- Logs show frequent `seekTo()` calls (> 1 per 5 seconds)
- Audio buffer underrun warnings in native logs
- Drift oscillates instead of converging

**Phase mapping:** Phase 1 (Drift Compensation) - This is THE critical issue for this phase.

---

### Pitfall 2: Background Playback Breaking Sync State
**What goes wrong:** App goes to background, playback continues via OS controls, but sync state becomes stale. When foregrounded, clients are out of sync with no recovery mechanism.

**Why it happens:**
- React Native Track Player runs in separate native thread
- Background service can't reliably emit socket events (iOS restrictions)
- Socket connection may drop in background (iOS after ~30s, Android varies)
- Remote control events (lock screen) bypass sync layer entirely

**Consequences:**
- Host pauses from lock screen → listeners keep playing
- Listener seeks from notification → host unaware of position change
- App returns to foreground with 30+ second position mismatch
- Version tracking completely broken (increments missed)

**Prevention:**
```typescript
// In TrackPlayerService.ts - DON'T emit sync events directly
TrackPlayer.addEventListener(Event.RemotePlay, () => {
  // BAD: This won't work reliably in background
  // syncService.emitPlay(...);

  // GOOD: Just control local playback
  TrackPlayer.play();
  // Sync will reconcile on foreground via state fetch
});

// In app foreground handler
AppState.addEventListener('change', async (state) => {
  if (state === 'active') {
    // Fetch authoritative state from server
    const serverState = await roomService.getRoomState(roomId);
    await reconcilePlaybackState(serverState);
  }
});
```

**Detection:**
- Sync breaks after app backgrounding
- Position jumps when returning to foreground
- "Ghost" play/pause events from background
- iOS: Socket disconnect logs after ~30 seconds in background

**Phase mapping:** Phase 2 (Background Playback) - Must design sync reconciliation from day one.

---

### Pitfall 3: Playlist Sync Race Conditions
**What goes wrong:** Multiple clients modify playlist simultaneously. Last-Write-Wins creates inconsistent state where clients have different track orders, duplicates, or missing tracks.

**Why it happens:**
- LWW doesn't handle list operations (insert at index, reorder)
- Network delays mean "last" is ambiguous
- No operation transformation for list edits
- Version tracking resets on track change (existing bug amplified)

**Consequences:**
- Client A adds track at position 2, Client B adds at position 2 → one overwrites
- Reordering playlist creates different orders on different clients
- "Skip to next" advances to different tracks for different users
- Playlist becomes append-only to avoid corruption

**Prevention:**
```typescript
// BAD: Position-based operations with LWW
{
  type: 'playlist:add',
  position: 2,  // Race condition: what if list changed?
  track: {...}
}

// GOOD: Use CRDTs or operation-based sync
{
  type: 'playlist:add',
  afterTrackId: 'track-123',  // Relative positioning
  track: {...},
  operationId: uuid(),  // Idempotent
  timestamp: serverTime
}

// Or: Restrict to host-only modifications
if (userId !== room.hostId) {
  return { success: false, error: 'Only host can modify playlist' };
}
```

**Detection:**
- Clients show different playlist orders
- Duplicate tracks appear
- "Next track" mismatch between clients
- Version conflicts spike after playlist edits

**Phase mapping:** Phase 3 (Playlist Sync) - Decide on conflict resolution strategy BEFORE implementing.

---

### Pitfall 4: Network Recovery Amplifying Stale State
**What goes wrong:** Client reconnects after network loss, receives stale cached state from server, then broadcasts that stale state to other clients, creating cascading desync.

**Why it happens:**
- In-memory room state has no persistence (existing issue)
- Server restarts → all room state lost
- Reconnecting client treated as "source of truth"
- No state versioning to detect staleness
- Heartbeat timeout not enforced (existing bug)

**Consequences:**
- Network blip causes 30-second rewind for all users
- Server restart loses all rooms → clients recreate with wrong state
- Zombie clients (disconnected but not timed out) poison state on reconnect
- "Split brain" where different client groups have different states

**Prevention:**
```typescript
// Server-side: Detect stale reconnections
socket.on('room:rejoin', async (data) => {
  const { roomId, lastKnownVersion, clientState } = data;
  const serverState = rooms.get(roomId);

  if (!serverState) {
    // Room lost (server restart) - need recovery strategy
    return { success: false, error: 'room_lost', shouldRecreate: true };
  }

  if (lastKnownVersion > serverState.version) {
    // Client has newer state (server restarted?)
    console.warn('Client state newer than server');
    // Option 1: Trust client (risky)
    // Option 2: Force client to resync (safer)
    return { success: true, state: serverState, forceResync: true };
  }

  // Normal reconnection
  return { success: true, state: serverState };
});

// Client-side: Validate received state
const validateState = (state: RoomState) => {
  const now = Date.now();
  const stateAge = now - state.lastUpdate;

  if (stateAge > 60000) {
    console.warn('Received stale state (> 60s old)');
    return false;
  }
  return true;
};
```

**Detection:**
- Playback rewinds after reconnection
- Logs show version numbers decreasing
- Multiple clients report different "current track"
- Heartbeat timeout warnings but clients still connected

**Phase mapping:** Phase 4 (Network Recovery) - Requires state persistence or recovery protocol.

---

## Moderate Pitfalls

### Pitfall 5: Time Sync Degradation Over Session
**What goes wrong:** Initial time sync is accurate, but offset drifts over long sessions (> 30 min) due to clock skew, causing gradual desync.

**Why it happens:**
- Current implementation syncs once at connection (60s interval)
- Device clocks drift at different rates (especially mobile)
- No continuous offset adjustment
- Network conditions change over session

**Prevention:**
- Reduce sync interval to 30s for active playback
- Implement Kalman filter for offset estimation
- Monitor drift rate and adjust sync frequency
- Re-sync on significant network condition changes

**Detection:**
- Drift increases linearly over time
- Sync quality degrades after 20-30 minutes
- Offset variance increases in logs

**Phase mapping:** Phase 1 (Drift Compensation) - Monitor during testing.

---

### Pitfall 6: Control Mode State Confusion
**What goes wrong:** Switching between "host controls all" and "individual control" modes mid-session creates ambiguous state about who can control what.

**Why it happens:**
- Mode change doesn't invalidate in-flight operations
- Clients cache old permissions
- No clear handoff protocol
- Existing version tracking issues amplified

**Prevention:**
```typescript
// Mode change must be atomic with version bump
const changeControlMode = (roomId: string, newMode: ControlMode) => {
  const room = rooms.get(roomId);
  room.controlMode = newMode;
  room.version++;  // Invalidate all pending operations

  // Broadcast mode change with new version
  io.to(roomId).emit('room:mode_changed', {
    mode: newMode,
    version: room.version,
    timestamp: Date.now()
  });

  // Clear any queued operations from old mode
  clearOperationQueue(roomId);
};
```

**Detection:**
- Listeners can control playback when they shouldn't
- Operations rejected with "permission denied" after mode change
- UI shows wrong control state

**Phase mapping:** Phase 5 (Control Modes) - Design state machine before implementing.

---

### Pitfall 7: Web Audio API Context Suspension
**What goes wrong:** Web clients lose sync after browser tab backgrounding because AudioContext suspends, but sync calculations continue assuming playback.

**Why it happens:**
- Browser autoplay policies suspend AudioContext in background tabs
- Sync service doesn't detect suspension
- Position calculations accumulate error while paused
- Resume doesn't recalculate from server state

**Prevention:**
```typescript
// Monitor AudioContext state
audioContext.addEventListener('statechange', () => {
  if (audioContext.state === 'suspended') {
    console.warn('AudioContext suspended');
    // Pause sync calculations
    syncService.pauseSync();
  } else if (audioContext.state === 'running') {
    // Resume with fresh state fetch
    syncService.resumeSync();
    fetchFreshPlaybackState();
  }
});

// Detect tab visibility
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Tab backgrounded - prepare for suspension
    saveCurrentState();
  } else {
    // Tab foregrounded - reconcile state
    reconcileWithServer();
  }
});
```

**Detection:**
- Web clients desync after tab switching
- Position jumps on tab focus
- "AudioContext suspended" warnings in console

**Phase mapping:** Phase 2 (Background Playback) - Web-specific handling needed.

---

### Pitfall 8: Theme Switching During Playback Causing Re-renders
**What goes wrong:** Theme change triggers full app re-render, disrupting audio service initialization or causing brief playback interruption.

**Why it happens:**
- Theme stored in React context wrapping entire app
- Context change forces re-render of all consumers
- Audio services re-initialize on component remount
- TrackPlayer setup called multiple times

**Prevention:**
```typescript
// Isolate theme from audio services
// BAD: Audio service inside theme provider
<ThemeProvider>
  <AudioServiceProvider>  {/* Re-mounts on theme change */}
    <App />
  </AudioServiceProvider>
</ThemeProvider>

// GOOD: Audio service outside theme scope
<AudioServiceProvider>  {/* Stable across theme changes */}
  <ThemeProvider>
    <App />
  </ThemeProvider>
</AudioServiceProvider>

// Or: Memoize audio components
const PlayerComponent = React.memo(({ audioService }) => {
  // Won't re-render on theme change
}, (prev, next) => prev.audioService === next.audioService);
```

**Detection:**
- Brief audio glitch when changing theme
- "TrackPlayer already initialized" warnings
- Playback position resets on theme change

**Phase mapping:** Phase 6 (Theme Switching) - Test with active playback.

---

## Minor Pitfalls

### Pitfall 9: Socket ID Race on Reconnection
**What goes wrong:** Client stores old socket ID, reconnects with new ID, but server operations use old ID causing "user not found" errors.

**Why it happens:**
- Existing bug: socket ID cached before connection complete
- Reconnection generates new ID
- Client doesn't update stored ID

**Prevention:**
```typescript
// Wait for connection before caching ID
socket.on('connect', () => {
  const newId = socket.id;
  updateStoredSocketId(newId);

  // Re-join rooms with new ID
  rejoinActiveRooms(newId);
});
```

**Detection:**
- "User not found" errors after reconnection
- Operations fail until app restart

**Phase mapping:** Phase 4 (Network Recovery) - Fix existing bug first.

---

### Pitfall 10: Unbounded Drift Correction Accumulation
**What goes wrong:** Drift compensation accumulates small errors over time, eventually causing large sudden correction.

**Why it happens:**
- Floating point precision errors
- No periodic reset to ground truth
- Correction deltas compound

**Prevention:**
- Periodically fetch authoritative position from server
- Reset drift calculation baseline every 5 minutes
- Use integer milliseconds for calculations

**Detection:**
- Drift slowly increases despite corrections
- Sudden large seek after long playback

**Phase mapping:** Phase 1 (Drift Compensation) - Add periodic reset.

---

### Pitfall 11: Heartbeat Timeout Not Enforced
**What goes wrong:** Disconnected clients remain in room state indefinitely, causing ghost users and stale state propagation.

**Why it happens:**
- Existing bug: timeout configured but not enforced
- No cleanup mechanism for stale connections

**Prevention:**
```typescript
// Server-side: Enforce heartbeat timeout
const HEARTBEAT_TIMEOUT = 30000;
const heartbeats = new Map<string, number>();

socket.on('heartbeat', () => {
  heartbeats.set(socket.id, Date.now());
});

setInterval(() => {
  const now = Date.now();
  heartbeats.forEach((lastBeat, socketId) => {
    if (now - lastBeat > HEARTBEAT_TIMEOUT) {
      console.log(`Removing stale client: ${socketId}`);
      removeClientFromRooms(socketId);
      heartbeats.delete(socketId);
    }
  });
}, 10000);
```

**Detection:**
- Disconnected users still shown in room
- Operations sent to non-existent clients

**Phase mapping:** Fix before Phase 4 (Network Recovery).

---

### Pitfall 12: Version Reset on Track Change
**What goes wrong:** Existing bug where version counter resets when track changes, breaking conflict detection.

**Why it happens:**
- Version tied to track state instead of room state
- Track change reinitializes state object

**Prevention:**
```typescript
// Version should be room-level, not track-level
interface RoomState {
  version: number;  // Never reset
  currentTrack: {
    id: string;
    // Track-specific state
  };
  playlist: Track[];
}

// Increment version on ANY state change
const updateRoomState = (roomId: string, changes: Partial<RoomState>) => {
  const room = rooms.get(roomId);
  Object.assign(room, changes);
  room.version++;  // Always increment
};
```

**Detection:**
- Version conflicts after track changes
- Operations accepted that should be rejected

**Phase mapping:** Fix before Phase 3 (Playlist Sync).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Drift Compensation | Fighting audio engine with aggressive corrections | Use tiered correction strategy (seek vs rate adjustment) |
| Background Playback | Sync state divergence when backgrounded | Implement foreground reconciliation protocol |
| Playlist Sync | Race conditions with LWW conflict resolution | Use operation-based sync or restrict to host-only |
| Network Recovery | Stale state propagation on reconnection | Add state versioning and validation |
| Control Modes | Permission confusion during mode transitions | Atomic mode change with version bump |
| Theme Switching | Audio service re-initialization | Isolate theme context from audio services |

---

## Existing Technical Debt Impact

These existing issues will amplify new feature pitfalls:

1. **In-memory storage (no persistence)**
   - Impact: Network recovery impossible after server restart
   - Blocks: Phase 4 (Network Recovery)
   - Fix: Add Redis or database persistence

2. **Version reset on track change**
   - Impact: Playlist sync conflicts undetectable
   - Blocks: Phase 3 (Playlist Sync)
   - Fix: Make version room-scoped, not track-scoped

3. **Heartbeat timeout not enforced**
   - Impact: Ghost clients poison state on reconnection
   - Blocks: Phase 4 (Network Recovery)
   - Fix: Implement timeout enforcement

4. **Socket ID race condition**
   - Impact: Reconnection operations fail
   - Blocks: Phase 4 (Network Recovery)
   - Fix: Update ID on 'connect' event, not before

5. **Unbounded cache growth**
   - Impact: Memory leaks during long sessions
   - Blocks: All phases (stability issue)
   - Fix: Add TTL and size limits to caches

6. **No tests**
   - Impact: Regressions undetected, confidence low
   - Blocks: All phases (quality issue)
   - Fix: Add integration tests for sync scenarios

---

## Cross-Cutting Concerns

### Testing Strategy for Sync Features
Without tests, these pitfalls are hard to detect:

```typescript
// Critical test scenarios
describe('Drift Compensation', () => {
  it('should not seek for drift < 500ms');
  it('should use rate adjustment for 500ms < drift < 3s');
  it('should hard seek for drift > 3s');
  it('should not correct more than once per 5s');
});

describe('Background Playback', () => {
  it('should reconcile state on foreground');
  it('should not emit sync events from background');
  it('should handle socket disconnect in background');
});

describe('Network Recovery', () => {
  it('should reject stale state on reconnection');
  it('should handle server restart gracefully');
  it('should timeout stale clients');
});
```

### Monitoring & Observability
Add metrics to detect pitfalls in production:

- Drift magnitude histogram (detect aggressive correction)
- Sync event frequency (detect event storms)
- State reconciliation count (detect background issues)
- Version conflict rate (detect race conditions)
- Reconnection success rate (detect recovery issues)

---

## Sources

**Confidence Level: MEDIUM**

- Codebase analysis: `SyncService.ts`, `TimeSyncService.ts`, `TrackPlayerService.ts`, `SocketManager.ts`
- Training data: React Native Track Player patterns, Socket.io reconnection, real-time sync algorithms
- Known issues: Documented in milestone context (version reset, heartbeat timeout, socket ID race, no persistence, no tests)

**Verification needed:**
- React Native Track Player background behavior on iOS 17+ (training data may be outdated)
- Socket.io v4.x reconnection defaults (verify current version)
- Web Audio API suspension policies in 2026 browsers

**Limitations:**
- No access to official React Native Track Player docs or recent issue discussions
- No verification of Socket.io best practices for 2026
- Recommendations based on general real-time sync principles + codebase analysis
