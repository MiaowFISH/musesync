# Roadmap: MuseSync

## Overview

This roadmap delivers four critical enhancements to the existing real-time music sync foundation: fixing blocking bugs, adding playlist management with room sync, enabling background playback with network recovery, and implementing flexible control modes. Each phase builds on the previous to create a robust, mobile-ready synchronized listening experience.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Bug Fixes & Foundation** - Fix blocking technical debt
- [x] **Phase 2: Playlist Management** - Queue with room sync
- [ ] **Phase 3: Background Playback & Network Recovery** - Mobile resilience
- [ ] **Phase 4: Control Modes** - Flexible room permissions

## Phase Details

### Phase 1: Bug Fixes & Foundation
**Goal**: Fix blocking bugs that prevent playlist sync and network recovery features
**Depends on**: Nothing (first phase)
**Requirements**: BUGF-01, BUGF-02
**Success Criteria** (what must be TRUE):
  1. Version number persists correctly across track changes without resetting to 0
  2. Socket reconnection completes without ID race conditions
  3. Existing sync features (play/pause/seek) continue working without regression
**Plans:** 3 plans

Plans:
- [ ] 01-01-PLAN.md — Fix version number reset (BUGF-01): version utility, SyncEngine fix, RoomManager fix
- [ ] 01-02-PLAN.md — Backend reconnection infrastructure (BUGF-02): clientId types, connection tracking, grace period, state snapshot
- [ ] 01-03-PLAN.md — Client reconnection + UI (BUGF-02): persistent UUID, rejoin flow, disabled controls, manual verification

### Phase 2: Playlist Management
**Goal**: Users can view, modify, and sync playback queue across all room members
**Depends on**: Phase 1 (requires version number fix)
**Requirements**: PLST-01, PLST-02, PLST-03, PLST-04, PLST-05, PLST-06
**Success Criteria** (what must be TRUE):
  1. User can view current song and upcoming songs in queue
  2. User can add songs from search results to queue
  3. User can remove songs from queue and reorder by drag-and-drop
  4. Queue changes sync to all room members in real-time
  5. Playback automatically advances to next song when current song ends
**Plans**: 5 plans

Plans:
- [ ] 02-01-PLAN.md — Shared types + Backend queue infrastructure: QueueItem type, queue event types, QueueManager service, queue handlers, server wiring (Wave 1)
- [ ] 02-02-PLAN.md — Client QueueService + Search "Add to Queue": QueueService singleton, SearchScreen add-to-queue button with duplicate detection (Wave 2)
- [ ] 02-03-PLAN.md — Queue UI components: install deps, QueueBottomSheet, QueueItem with swipe-delete, drag-drop reorder, EmptyQueueState (Wave 2)
- [ ] 02-04-PLAN.md — Integration: PlayerScreen wiring, useQueueSync hook, auto-advance, loop mode, toast notifications, reconnection sync (Wave 3)
- [ ] 02-05-PLAN.md — Manual verification: multi-device queue sync testing (Wave 4)

### Phase 3: Background Playback & Network Recovery
**Goal**: Music continues playing when app is backgrounded, and app gracefully recovers from network disruptions
**Depends on**: Phase 2 (requires complete state to restore)
**Requirements**: BGPB-01, BGPB-02, BGPB-03, BGPB-04, NETR-01, NETR-02, NETR-03, NETR-04, NETR-05
**Success Criteria** (what must be TRUE):
  1. Music continues playing when app moves to background on iOS and Android
  2. Lock screen shows playback controls (play/pause/skip) on both platforms
  3. App detects network disconnection and displays status to user
  4. App automatically reconnects and resyncs playback position after network recovery
  5. Stale state (older than 60s) is rejected and not propagated to other clients
  6. App reconciles sync state when returning to foreground after background playback
**Plans**: TBD

Plans:
- [ ] 03-01: [To be planned]

### Phase 4: Control Modes
**Goal**: Room creator can choose who controls playback (host-only, open, or queue mode)
**Depends on**: Phase 2 (requires playlist infrastructure for queue mode)
**Requirements**: CTRL-01, CTRL-02, CTRL-03, CTRL-04, CTRL-05, CTRL-06, CTRL-07
**Success Criteria** (what must be TRUE):
  1. Room creator can switch between three control modes: host-only, open, and queue
  2. In host-only mode, only host can control playback; non-host users see disabled controls
  3. In open mode, any member can control playback (current behavior)
  4. In queue mode, any member can add songs; system plays in order with upvote-based reordering
  5. Server enforces permission checks and rejects unauthorized control events
  6. Control mode changes broadcast to all room members in real-time
**Plans**: TBD

Plans:
- [ ] 04-01: [To be planned]

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Bug Fixes & Foundation | 3/3 | ✓ Complete | 2026-02-14 |
| 2. Playlist Management | 5/5 | ✓ Complete | 2026-02-14 |
| 3. Background Playback & Network Recovery | 0/TBD | Not started | - |
| 4. Control Modes | 0/TBD | Not started | - |
