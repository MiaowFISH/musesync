---
phase: 03-background-playback-network-recovery
plan: 02
subsystem: audio-lifecycle
tags: [expo-audio, react-native, AppState, lock-screen, background-playback, state-reconciliation]

# Dependency graph
requires:
  - phase: 03-01
    provides: StateReconciler service for foreground/reconnection state sync
provides:
  - AppLifecycleManager service for foreground/background detection
  - useAppLifecycle hook for applying reconciliation results
  - Lock screen controls with skip next/previous support
  - Background sync suppression (queue:updated events ignored when backgrounded)
  - Foreground return triggers state reconciliation with Toast notifications
affects: [03-03, 03-04, future-phases-with-background-behavior]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AppState listener pattern for lifecycle detection"
    - "Dynamic require() to avoid circular dependencies in event handlers"
    - "Lock screen remote control callbacks via AudioService facade"

key-files:
  created:
    - app/src/services/lifecycle/AppLifecycleManager.ts
    - app/src/hooks/useAppLifecycle.ts
    - app/src/components/lifecycle/AppLifecycleWatcher.tsx
  modified:
    - app/src/services/audio/NativeAudioService.ts
    - app/src/services/audio/AudioService.ts
    - app/src/hooks/useQueueSync.ts
    - app/src/stores/index.tsx
    - app/App.tsx

key-decisions:
  - "Dynamic require() for appLifecycleManager in event handlers to avoid circular dependency"
  - "Lock screen skip controls wired through AudioService facade with setOnRemoteNext/Previous methods"
  - "Background sync suppression checks isBackgrounded() before processing queue:updated events"

patterns-established:
  - "Lifecycle manager singleton pattern with listener subscription model"
  - "Reconciliation result application in React hook with async audio fetching"
  - "AppLifecycleWatcher component pattern for root-level hook activation"

# Metrics
duration: 4min
completed: 2026-02-15
---

# Phase 03 Plan 02: Background Playback & Foreground Reconciliation Summary

**AppLifecycleManager detects foreground/background transitions, triggers StateReconciler on return, applies changes with Toast notifications, and lock screen shows skip controls with progress bar**

## Performance

- **Duration:** 4 min 16s
- **Started:** 2026-02-14T16:10:02Z
- **Completed:** 2026-02-14T16:14:18Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- AppLifecycleManager service detects app foreground/background transitions via AppState listener
- Foreground return triggers StateReconciler and applies results (track change, position sync, play state) with Toast notifications
- Lock screen displays full metadata (title, artist, cover art, duration) with skip next/previous controls
- Background sync suppression: queue:updated events ignored when app is backgrounded
- AppLifecycleWatcher component wired at app root level to activate lifecycle management

## Task Commits

Each task was committed atomically:

1. **Task 1: AppLifecycleManager + useAppLifecycle hook** - `c918500` (feat)
2. **Task 2: Lock screen skip controls + background sync suppression + wiring** - `a028846` (feat)

## Files Created/Modified
- `app/src/services/lifecycle/AppLifecycleManager.ts` - Detects foreground/background transitions, triggers StateReconciler on foreground return
- `app/src/hooks/useAppLifecycle.ts` - React hook that applies reconciliation results (track change, position sync, play state) with Toast notifications
- `app/src/components/lifecycle/AppLifecycleWatcher.tsx` - Invisible component that activates useAppLifecycle at app root level
- `app/src/services/audio/NativeAudioService.ts` - Enhanced with remote next/previous callbacks and duration in lock screen metadata
- `app/src/services/audio/AudioService.ts` - Exposed setOnRemoteNext/Previous methods in facade
- `app/src/hooks/useQueueSync.ts` - Wired lock screen skip controls to queue advance, added background sync suppression for toasts
- `app/src/stores/index.tsx` - Added background sync suppression for queue:updated events in RoomProvider
- `app/App.tsx` - Wired AppLifecycleWatcher component inside StoreProvider

## Decisions Made
- Used dynamic require() for appLifecycleManager in event handlers to avoid circular dependency between stores and lifecycle manager
- Lock screen skip controls wired through AudioService facade with setOnRemoteNext/Previous methods (native-only, no-op on web)
- Background sync suppression checks isBackgrounded() before processing queue:updated events in both RoomProvider and useQueueSync

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - implementation proceeded smoothly with clear separation between lifecycle detection (AppLifecycleManager), reconciliation (StateReconciler from 03-01), and UI application (useAppLifecycle hook).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Background playback independence complete: music plays independently in background, sync events suppressed
- Foreground return reconciliation complete: app fetches latest room state, applies changes, shows Toast
- Lock screen controls complete: skip next/previous wired to queue advance
- Ready for 03-03 (network recovery) and 03-04 (heartbeat timeout detection)
- Note: Lock screen remote control events from iOS/Android system are not yet wired (expo-audio may not expose these events directly) - skip controls currently triggered programmatically via setOnRemoteNext/Previous callbacks

## Self-Check: PASSED

All created files verified:
- ✓ app/src/services/lifecycle/AppLifecycleManager.ts
- ✓ app/src/hooks/useAppLifecycle.ts
- ✓ app/src/components/lifecycle/AppLifecycleWatcher.tsx

All commits verified:
- ✓ c918500 (Task 1)
- ✓ a028846 (Task 2)

---
*Phase: 03-background-playback-network-recovery*
*Completed: 2026-02-15*
