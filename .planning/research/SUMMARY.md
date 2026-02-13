# Project Research Summary

**Project:** MusicTogether
**Domain:** Real-time synchronized music playback (multi-client)
**Researched:** 2026-02-14
**Confidence:** MEDIUM

## Executive Summary

MusicTogether is a real-time music synchronization app that enables multiple users to listen to music together in perfect sync. The next milestone focuses on six incremental features that enhance the existing React Native/Expo/Socket.io foundation: drift compensation, background playback, playlist management, network recovery, host-only control mode, and light theme support.

The recommended approach leverages the existing stack extensively. Most features require no new dependencies - drift compensation uses Track Player's built-in rate adjustment API, playlist sync extends existing Socket.io patterns, and theme switching builds on the current theme infrastructure. Only network monitoring requires a new dependency (@react-native-community/netinfo). The architecture follows established patterns: client-side Zustand stores, Socket.io event broadcasting, and Last-Write-Wins conflict resolution.

The critical risk is drift compensation fighting the audio engine. Aggressive seeking causes audio glitches worse than the drift itself. The mitigation is a tiered correction strategy: ignore drift under 500ms, use playback rate adjustment (0.95x-1.05x) for moderate drift, and only hard-seek for major desync. Secondary risks include background playback breaking sync state (requires foreground reconciliation protocol) and playlist race conditions (needs operation-based sync or host-only restrictions).

## Key Findings

### Recommended Stack

The existing stack (React Native 0.81.5, Expo 54, Socket.io 4.6/4.8, React Native Track Player 4.1.2) already supports most milestone features. This is algorithmic work, not library integration.

**Core technologies:**
- **React Native Track Player 4.1.2** (existing): Drift compensation via setRate() and seekTo() - no new dependencies needed
- **Socket.io 4.6.1/4.8.3** (existing): Playlist sync events - extend existing event types in shared/types/socket-events.ts
- **Zustand** (existing): Playlist state management - follow same patterns as current track sync
- **@react-native-community/netinfo ^11.4.1** (NEW): Network state monitoring for recovery - industry standard for React Native
- **Built-in theme system** (existing): Light theme support - extend constants/theme.ts and hooks/useTheme.ts

**Optional dependencies (only if needed):**
- expo-background-fetch: Only if maintaining socket connection while backgrounded (likely unnecessary)
- expo-notifications: Only if custom notification UI needed beyond Track Player's default

**Configuration changes:**
- Enable Socket.io connection state recovery (maxDisconnectionDuration: 2 minutes)
- Verify iOS background audio mode in app.config.ts (may already be configured)

### Expected Features

**Must have (table stakes):**
- **Drift compensation**: Core sync requirement - without it, users hear different parts of song after 30-60 seconds. Target <50ms accuracy.
- **Background playback**: Mobile users expect music to continue when app is backgrounded or screen locks. Platform-specific requirements (iOS audio session, Android foreground service).
- **Network recovery**: Connection drops are common on mobile - app must gracefully handle and resync. Must preserve room state, queue position, and playback position on reconnect.
- **Basic playlist/queue**: Users expect to see what's playing next and add songs to queue. Minimum: current song, next songs, ability to add.

**Should have (competitive):**
- **Host-only control mode**: Prevents chaos in large rooms - only host can control playback. Toggle between "everyone controls" vs "host only". Useful for DJ scenarios, listening parties.
- **Theme switching (light/dark)**: Personalization and accessibility. Quick win with existing infrastructure.

**Defer (v2+):**
- Collaborative playlist editing (build basic queue first, then add collaboration)
- Reaction system (social feature, not critical for core sync)
- Lyrics sync (depends on API availability)
- Playlist templates (can add after collaborative editing works)
- Listening statistics (analytics feature, not core)
- Cross-fade (polish feature, complex)
- Room persistence (requires backend changes)

### Architecture Approach

The architecture is client-server with real-time synchronization using Socket.io. Client state is managed via React Context (four providers: Room, Player, Preferences, Connection). Server maintains authoritative state in-memory via RoomStore with Last-Write-Wins conflict resolution using version numbers. Audio playback uses platform abstraction (Web Audio API vs React Native Track Player).

**Major components:**
1. **SyncEngine (backend)**: Broadcasts sync state and resolves concurrent updates using Last-Write-Wins with version numbers. Handles heartbeat monitoring and member timeout detection.
2. **AudioService (client)**: Platform abstraction for unified audio interface. Strategy pattern selects Web vs Native implementation at runtime. Methods: play(), pause(), seek(), setRate(), onProgress().
3. **RoomManager (backend)**: Room lifecycle and member management. Validates input, manages room state, enforces permissions via canControl().
4. **SocketManager (client)**: Centralized Socket.io connection with automatic reconnection and exponential backoff. Type-safe event emission/listening.
5. **TimeSyncService (both)**: NTP-like protocol to calculate client-server time offset and latency for accurate drift compensation.

### Critical Pitfalls

1. **Drift compensation fighting audio engine**: Aggressive seeking causes audio glitches, buffer underruns, and worse sync than doing nothing. Use tiered correction strategy: ignore drift <500ms, use playback rate adjustment for 500ms-3s drift, only hard-seek for >3s drift. Never correct more than once per 5 seconds.

2. **Background playback breaking sync state**: App goes to background, playback continues via OS controls, but sync state becomes stale. Socket connection drops (iOS after ~30s). Remote control events (lock screen) bypass sync layer entirely. Don't emit sync events from background - implement foreground reconciliation protocol that fetches authoritative state on app resume.

3. **Playlist sync race conditions**: Multiple clients modify playlist simultaneously. Last-Write-Wins doesn't handle list operations (insert at index, reorder). Use operation-based sync with relative positioning (afterTrackId) or restrict to host-only modifications.

4. **Network recovery amplifying stale state**: Client reconnects after network loss, receives stale cached state from server, then broadcasts that stale state to other clients. Add state versioning and validation - reject state older than 60 seconds, implement heartbeat timeout enforcement.

5. **Existing technical debt amplification**: Version reset on track change (blocks playlist sync), heartbeat timeout not enforced (blocks network recovery), socket ID race condition (blocks reconnection), in-memory storage with no persistence (blocks recovery after server restart). These must be fixed before implementing dependent features.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Drift Compensation
**Rationale:** Core sync quality issue. Without this, the "sync" promise breaks down after 30-60 seconds. Must come first because it's the foundation for all other sync features.
**Delivers:** <50ms sync accuracy using tiered correction strategy (soft sync via playback rate, hard sync via seeking)
**Addresses:** Table stakes feature - users expect tight sync in a "sync music player"
**Avoids:** Pitfall #1 (fighting audio engine) by using gentle playback rate adjustments instead of aggressive seeking
**Implementation:** Extend TimeSyncService to calculate drift, use Track Player's setRate() for 500ms-3s drift, seekTo() only for >3s drift
**Research flag:** LOW - Track Player API verified in codebase, standard pattern

### Phase 2: Background Playback with Sync Reconciliation
**Rationale:** Mobile music app requirement. Users will abandon if music stops when they switch apps. Must come after drift compensation because reconciliation requires drift correction.
**Delivers:** Continuous playback when app backgrounded, foreground state reconciliation protocol
**Addresses:** Table stakes feature - mobile users expect background audio
**Avoids:** Pitfall #2 (sync state divergence) by implementing foreground reconciliation instead of maintaining socket in background
**Implementation:** Use Track Player's built-in background audio support, add AppState listener for foreground detection, fetch authoritative state on resume
**Research flag:** MEDIUM - Track Player supports background audio, but socket reconnection strategy needs validation on iOS 17+

### Phase 3: Playlist Management with Room Sync
**Rationale:** Users expect to see what's playing next. Depends on Phase 1 (drift compensation) for accurate queue progression. Must fix version reset bug first.
**Delivers:** Basic queue (current song, next songs, add to queue), Socket.io playlist sync events
**Addresses:** Table stakes feature - users can't plan listening session without queue visibility
**Avoids:** Pitfall #3 (race conditions) by using operation-based sync with relative positioning or restricting to host-only
**Implementation:** Extend Zustand store pattern, add playlist events to socket-events.ts, use afterTrackId for relative positioning
**Research flag:** LOW - extends existing Socket.io patterns
**Prerequisite:** Fix version reset on track change bug (existing technical debt)

### Phase 4: Network Recovery with State Restoration
**Rationale:** Connection drops are common on mobile. Depends on Phases 1-3 for complete state to restore. Must fix heartbeat timeout and socket ID race bugs first.
**Delivers:** Graceful reconnection with state validation, stale state rejection, heartbeat timeout enforcement
**Addresses:** Table stakes feature - app must handle network instability
**Avoids:** Pitfall #4 (stale state propagation) by adding state versioning and age validation
**Implementation:** Add @react-native-community/netinfo for network monitoring, implement rejoin protocol with state validation, enforce heartbeat timeout
**Research flag:** LOW - standard Socket.io reconnection pattern
**Prerequisites:** Fix heartbeat timeout enforcement, fix socket ID race condition, add state persistence or recovery protocol

### Phase 5: Host-Only Control Mode
**Rationale:** Simple feature that enables new use cases (DJ mode, listening parties). No dependencies on other phases. Can be done anytime.
**Delivers:** Toggle between "everyone controls" vs "host only" mode, server-side permission enforcement
**Addresses:** Differentiator feature - prevents chaos in large rooms
**Avoids:** Pitfall #6 (control mode confusion) by making mode change atomic with version bump
**Implementation:** Add controlMode flag to room entity, validate userId against hostId in backend handlers, conditionally disable controls in UI
**Research flag:** NONE - simple authorization logic

### Phase 6: Light Theme Support
**Rationale:** Quick win with existing infrastructure. No dependencies. Accessibility improvement.
**Delivers:** Light theme color palette, theme toggle in preferences, automatic component adaptation
**Addresses:** Differentiator feature - personalization and accessibility
**Avoids:** Pitfall #8 (audio service re-initialization) by isolating theme context from audio services
**Implementation:** Add light theme to constants/theme.ts, extend useTheme hook, add toggle to PreferencesStorage
**Research flag:** NONE - verified existing theme infrastructure

### Phase Ordering Rationale

- **Phases 1-4 are sequential dependencies**: Drift compensation → Background playback → Playlist sync → Network recovery. Each phase builds on the previous one's capabilities.
- **Phases 5-6 are independent**: Host-only mode and theme switching can be done anytime, in parallel with other work.
- **Technical debt must be fixed first**: Version reset bug blocks Phase 3, heartbeat timeout and socket ID race block Phase 4. These fixes should be done before starting dependent phases.
- **Grouping by risk**: High-risk phases (1-2) come first to validate core assumptions. Low-risk phases (5-6) can be done quickly for early wins.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Background Playback)**: Track Player background behavior on iOS 17+ may differ from training data. Need to verify audio session configuration and socket reconnection strategy.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Drift Compensation)**: Track Player API verified in codebase, tiered correction strategy is standard pattern
- **Phase 3 (Playlist Sync)**: Extends existing Socket.io patterns, operation-based sync is well-documented
- **Phase 4 (Network Recovery)**: Standard Socket.io reconnection pattern with NetInfo
- **Phase 5 (Host-Only Mode)**: Simple authorization logic, no research needed
- **Phase 6 (Theme Switching)**: Existing theme infrastructure verified in codebase

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Existing stack verified in codebase, only one new dependency needed (NetInfo) |
| Features | MEDIUM | Based on training data about similar products (Spotify Group Session, Discord Listen Along), unable to verify 2026 state |
| Architecture | HIGH | Codebase analysis shows clear patterns, existing abstractions support new features |
| Pitfalls | MEDIUM | Based on codebase analysis + training data, but React Native Track Player behavior on iOS 17+ needs verification |

**Overall confidence:** MEDIUM

### Gaps to Address

- **React Native Track Player background behavior**: Training data may be outdated for iOS 17+. Validate audio session configuration and background audio capabilities during Phase 2 planning.
- **Socket.io v4.x reconnection defaults**: Verify current version's connection state recovery settings and best practices for 2026.
- **NetInfo latest version**: Check npm for latest stable version compatible with Expo 54 before installation.
- **Existing technical debt impact**: Version reset bug, heartbeat timeout, socket ID race, no persistence, no tests. These must be fixed before dependent phases or they will amplify new feature pitfalls.

## Sources

### Primary (HIGH confidence)
- **Codebase analysis**: app/package.json, backend/package.json, app/src/services/, app/src/hooks/useTheme.ts, shared/types/
- **React Native Track Player API**: Verified in app/src/services/audio/TrackPlayerService.ts (setRate(), seekTo(), getPosition() methods)
- **Socket.io patterns**: Verified in app/src/services/sync/SocketManager.ts (reconnection with exponential backoff)
- **Architecture documentation**: .planning/codebase/ARCHITECTURE.md (layer analysis, data flow, abstractions)

### Secondary (MEDIUM confidence)
- **Training data**: Similar products (Spotify Group Session, Discord Listen Along, JQBX, Vertigo, AmpMe)
- **Training data**: React Native patterns, NetInfo usage, background fetch, general real-time sync algorithms
- **Training data**: Socket.io reconnection patterns, Last-Write-Wins conflict resolution

### Tertiary (LOW confidence)
- **Web tools unavailable**: Could not verify latest versions via Context7 or official docs
- **iOS 17+ behavior**: Training data may not reflect latest iOS background audio policies
- **2026 best practices**: Unable to verify current state of React Native ecosystem

---
*Research completed: 2026-02-14*
*Ready for roadmap: yes*
