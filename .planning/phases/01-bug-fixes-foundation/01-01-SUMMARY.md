---
phase: 01-bug-fixes-foundation
plan: 01
status: completed
started: 2026-02-14
completed: 2026-02-14
commit: ad7f41a
---

## Summary

Fixed BUGF-01: Version number reset on track change.

### What was done

1. Created `backend/src/services/sync/versionUtils.ts` — centralized version management with `incrementVersion()` (wraps at 2^50) and `isVersionNewer()` (wrap-around safe comparison).

2. Fixed `SyncEngine.handleSyncUpdate` — removed `isNewTrack` variable and version reset logic. Version now always increments via `incrementVersion()`. Added 300ms leading-edge track change debounce to prevent rapid track changes from causing sync issues.

3. Fixed `RoomManager.updateSyncState` — removed double-increment bug where version was incremented both in SyncEngine and RoomManager. Now accepts version as-is from SyncEngine. Initial room version starts at 1 instead of 0.

### Verification

- No `isNewTrack` references remain in SyncEngine
- `incrementVersion()` used for all version management
- `updateSyncState` accepts version directly (no double-increment)
- Initial room version is 1
- Backend type-check passes (no new errors)
