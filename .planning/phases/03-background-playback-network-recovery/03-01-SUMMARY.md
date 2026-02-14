---
phase: 03-background-playback-network-recovery
plan: 01
subsystem: sync
tags: [state-reconciliation, stale-state-rejection, heartbeat-enforcement, network-recovery]
completed: 2026-02-15

dependencies:
  requires:
    - phase: 01
      plan: 03
      artifact: TimeSyncService
      reason: StaleStateValidator uses clock offset for accurate timestamp comparison
  provides:
    - artifact: StateReconciler
      exports: [StateReconciler, stateReconciler, ReconciliationResult]
      used_by: [foreground-return, network-reconnection]
    - artifact: StaleStateValidator
      exports: [isStateStale, validateState]
      used_by: [StateReconciler]
    - artifact: room:state_snapshot
      type: socket-event
      used_by: [StateReconciler]
  affects:
    - component: SyncEngine
      change: Heartbeat timeout reduced from 10min to 60s
    - component: SyncEngine
      change: Heartbeat interval reduced from 5min to 30s

tech_stack:
  added: []
  patterns:
    - Singleton pattern for StateReconciler
    - Sync lock to prevent concurrent reconciliation
    - Request-response pattern for room:state_snapshot

key_files:
  created:
    - app/src/services/sync/StaleStateValidator.ts
    - app/src/services/sync/StateReconciler.ts
  modified:
    - shared/src/types/socket-events.ts
    - backend/src/services/sync/SyncEngine.ts
    - backend/src/handlers/roomHandlers.ts
    - backend/src/handlers/syncHandlers.ts

decisions:
  - decision: "Shared reconciliation logic for foreground-return and network-reconnection"
    rationale: "Per user requirement: 断线和回前台的同步逻辑应该复用同一套机制"
    impact: "Both scenarios use StateReconciler.reconcile() with source parameter"
  - decision: "60-second stale state threshold"
    rationale: "NETR-04 requirement: reject state older than 60s to prevent applying outdated room state"
    impact: "Uses TimeSyncService offset for accurate age calculation"
  - decision: "60-second heartbeat timeout with 30-second interval"
    rationale: "NETR-05 requirement: more responsive timeout detection and cleanup"
    impact: "Changed from 10min timeout / 5min interval to 60s / 30s"
  - decision: "Chinese toast messages for state changes"
    rationale: "User decision from context: 房间已切到第X首, 房间已继续播放/暂停"
    impact: "StateReconciler generates localized messages based on detected changes"

metrics:
  duration: 4 min
  tasks_completed: 2
  files_created: 2
  files_modified: 4
  commits: 2
  deviations: 0
---

# Phase 03 Plan 01: State Reconciliation Foundation Summary

**One-liner:** Shared state reconciliation with 60s stale rejection and server heartbeat enforcement for foreground-return and network-reconnection

## Objective

Create the shared state reconciliation foundation that both foreground-return and network-reconnection will use, including stale state rejection (NETR-04) and server-side heartbeat enforcement (NETR-05).

## What Was Built

### 1. StaleStateValidator (NETR-04)
- `isStateStale(serverTimestamp)`: Returns true if state age > 60s
- `validateState(serverTimestamp)`: Returns validation result with age info and reason
- Uses `timeSyncService.getServerTime()` for accurate clock-offset-adjusted comparison
- Prevents applying outdated room state after long disconnections

### 2. StateReconciler Service
- **Singleton pattern** with `stateReconciler` instance
- **Sync lock** prevents concurrent reconciliation (pitfall 3: race condition between AppState and network events)
- `reconcile({ roomId, userId, source, currentState })`:
  - Fetches authoritative room state via `room:state_snapshot` event
  - Validates state freshness using StaleStateValidator
  - Detects changes: trackChanged, positionDrift (>3s), playStateChanged, queueChanged
  - Generates Chinese toast messages: "房间已切到第X首", "房间已继续播放/暂停"
  - Returns `ReconciliationResult` with applied status, changes, newState, toastMessage
- **Shared by both foreground-return and network-reconnection** (per user requirement)

### 3. room:state_snapshot Event
- Added `RoomStateSnapshotRequest` and `RoomStateSnapshotResponse` types to socket-events
- Updated `SocketEvents` interface with callback pattern
- Server handler in `roomHandlers.ts`:
  - Returns full room state: room, syncState, playlist, currentTrackIndex, loopMode, serverTimestamp
  - Updates member activity timestamp on request

### 4. Enhanced Server Heartbeat Enforcement (NETR-05)
- **Heartbeat interval**: 300000ms (5min) → 30000ms (30s) for responsive timeout detection
- **Member timeout**: 600000ms (10min) → 60000ms (60s) per NETR-05 requirement
- Added `resetHeartbeat(roomId, userId)` method to reset timer when heartbeat received
- Enhanced `checkMemberTimeout()`:
  - Emits both `member:timeout` and `member:disconnected` events
  - Calls `roomManager.leaveRoom()` to actually remove timed-out members
  - Cleans up room if deleted
- Updated `sync:heartbeat` handler to call `updateMemberActivity()` and `resetHeartbeat()`

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

✅ StaleStateValidator correctly uses TimeSyncService offset for accurate age calculation
✅ StateReconciler provides reconcile() method with sync lock and change detection
✅ room:state_snapshot handler returns complete room state with serverTimestamp
✅ Server heartbeat timeout is 60s (NETR-05)
✅ Server heartbeat interval is 30s for responsive detection
✅ TypeScript types compile correctly (pre-existing codebase errors unrelated to changes)

## Success Criteria

✅ StateReconciler is importable and provides reconcile() method
✅ StaleStateValidator correctly rejects state older than 60s using synced time
✅ Server disconnects clients after 60s of inactivity
✅ room:state_snapshot event is handled server-side and returns authoritative state
✅ No TypeScript compilation errors in new code

## Integration Points

**Upstream dependencies:**
- `TimeSyncService.getServerTime()` - Used by StaleStateValidator for clock-offset-adjusted time

**Downstream usage:**
- Plan 03-02 (Foreground Return): Will call `stateReconciler.reconcile({ source: 'foreground' })`
- Plan 03-03 (Network Reconnection): Will call `stateReconciler.reconcile({ source: 'reconnection' })`

**Key exports:**
- `app/src/services/sync/StateReconciler.ts`: `StateReconciler`, `stateReconciler`, `ReconciliationResult`
- `app/src/services/sync/StaleStateValidator.ts`: `isStateStale`, `validateState`
- `shared/src/types/socket-events.ts`: `RoomStateSnapshotRequest`, `RoomStateSnapshotResponse`

## Notes

- The shared reconciliation logic fulfills the user requirement: "断线和回前台的同步逻辑应该复用同一套机制"
- Sync lock prevents race conditions when both AppState and network events trigger reconciliation simultaneously
- Chinese toast messages follow user's language preference from context
- Server heartbeat enforcement is now much more responsive (60s vs 10min) for better UX
- State age validation uses TimeSyncService offset to handle client clock drift accurately

## Self-Check: PASSED

**Created files verified:**
```bash
✅ app/src/services/sync/StaleStateValidator.ts
✅ app/src/services/sync/StateReconciler.ts
```

**Commits verified:**
```bash
✅ 980c15f: feat(03-01): add stale state validator and room:state_snapshot event types
✅ 9032925: feat(03-01): add StateReconciler service and enhance server heartbeat enforcement
```

All claimed artifacts exist and commits are in git history.
