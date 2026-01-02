# Tasks: 多设备实时同步音乐播放器

**Branch**: `001-realtime-sync-player`  
**Input**: Design documents from [specs/001-realtime-sync-player/](.)  
**Generated**: 2026-01-02

**Tests**: This feature does NOT request explicit TDD, so test tasks are OPTIONAL and not included by default.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `- [ ] [ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: User story label (US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

Per [plan.md](plan.md) structure:
- **Mobile**: `app/src/`
- **Web**: `web/src/`
- **Backend**: `backend/src/`
- **Shared**: `shared/`

---

## Phase 1: Setup (Shared Infrastructure) ✅ COMPLETE

**Purpose**: Project initialization and basic structure

- [X] T001 Create root project structure (app/, web/, backend/, shared/, specs/)
- [X] T002 Initialize backend with Bun and TypeScript (backend/package.json, tsconfig.json)
- [X] T003 [P] Initialize mobile app with Expo and React Native 0.83.x (app/package.json, app.json)
- [X] T004 [P] Initialize web app with Expo Web or Vite (web/package.json, vite.config.ts)
- [X] T005 [P] Configure ESLint and Prettier in root (eslintrc.js, .prettierrc)
- [X] T006 [P] Setup shared types directory with base entity interfaces (shared/types/entities.ts)
- [X] T007 [P] Setup shared constants with socket event names and sync thresholds (shared/constants/index.ts)
- [X] T008 Create environment configuration files (.env.example for backend, app, web)
- [X] T009 [P] Setup Git ignore patterns for node_modules, build artifacts, .env files

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Backend Foundation ✅ COMPLETE

- [X] T010 Create Express server with CORS and JSON middleware in backend/src/server.ts
- [X] T011 Setup Socket.io server with ping/pong configuration (25s interval, 60s timeout) in backend/src/server.ts
- [X] T012 [P] Implement basic room manager service structure in backend/src/services/room/RoomManager.ts
- [X] T013 [P] Implement NetEase Music API proxy service structure in backend/src/services/music/MusicService.ts
- [X] T014 [P] Setup in-memory storage for room state (or Redis client if using cache) in backend/src/services/room/RoomStore.ts
- [X] T015 Create Socket.io event type definitions from contracts in shared/types/socket-events.ts
- [X] T016 Create REST API type definitions from contracts in shared/types/api.ts
- [X] T017 [P] Implement health check endpoint GET /api/health in backend/src/server.ts

### Frontend Foundation (Mobile & Web)

- [ ] T018 Setup React Navigation for mobile app with stack navigator in app/src/navigation/AppNavigator.tsx
- [ ] T019 [P] Setup React Navigation for web app in web/src/navigation/AppNavigator.tsx
- [ ] T020 [P] Create Socket.io client connection manager in app/src/services/sync/SocketManager.ts
- [ ] T021 [P] Create Socket.io client connection manager in web/src/services/sync/SocketManager.ts
- [ ] T022 [P] Setup AsyncStorage wrapper for local preferences in app/src/services/storage/LocalStorage.ts
- [ ] T023 [P] Setup LocalStorage wrapper for local preferences in web/src/services/storage/LocalStorage.ts
- [ ] T024 [P] Create state management store with Zustand (room state, player state, preferences) in app/src/stores/index.ts
- [ ] T025 [P] Create state management store with Zustand (room state, player state, preferences) in web/src/stores/index.ts
- [ ] T026 [P] Create base UI components (Button, Input, Card) with theme support in app/src/components/ui/
- [ ] T027 [P] Create base UI components (Button, Input, Card) with theme support in web/src/components/ui/
- [ ] T028 Setup theme configuration (dark/light colors, fonts, spacing) in app/src/constants/theme.ts
- [ ] T029 [P] Setup theme configuration (dark/light colors, fonts, spacing) in web/src/constants/theme.ts

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 单设备音乐播放与音质调节 (Priority: P1) 🎯 MVP

**Goal**: Users can play music on a single device with full EQ control, no network required

**Independent Test**: Open app, search for a song, play it, adjust EQ, verify audio changes in real-time. Lock screen and verify background playback (mobile).

### US1 - Backend (NetEase API Proxy)

- [ ] T030 [P] [US1] Implement search endpoint GET /api/music/search with caching (24h TTL) in backend/src/services/music/MusicService.ts
- [ ] T031 [P] [US1] Implement song detail endpoint GET /api/music/song/:id with caching in backend/src/services/music/MusicService.ts
- [ ] T032 [P] [US1] Implement audio URL endpoint GET /api/music/audio/:id with caching (20min TTL) in backend/src/services/music/MusicService.ts
- [ ] T033 [US1] Add rate limiting middleware (10 req/min for search, 20 req/min for audio) in backend/src/middleware/rateLimiter.ts
- [ ] T034 [US1] Add error handling for NetEase API failures with retry logic in backend/src/services/music/MusicService.ts
- [ ] T035 [P] [US1] Implement batch audio URL endpoint POST /api/music/batch/audio in backend/src/services/music/MusicService.ts

### US1 - Mobile Audio Engine

- [ ] T036 [US1] Setup React Native Track Player with capabilities (play, pause, seek, next, previous) in app/src/services/audio/PlayerService.ts
- [ ] T037 [US1] Configure iOS AVAudioSession for background playback in app/app.json (UIBackgroundModes: audio)
- [ ] T038 [US1] Configure Android FOREGROUND_SERVICE permission in app/app.json (android.permissions)
- [ ] T039 [US1] Implement playback control methods (play, pause, seek, getPosition) in app/src/services/audio/PlayerService.ts
- [ ] T040 [US1] Implement progress tracking with useProgress hook in app/src/hooks/usePlayer.ts
- [ ] T041 [US1] Implement playback rate adjustment for soft sync (0.95-1.05x) in app/src/services/audio/PlayerService.ts
- [ ] T042 [P] [US1] Implement notification controls for background playback in app/src/services/audio/PlayerService.ts

### US1 - Web Audio Engine

- [ ] T043 [US1] Setup Web Audio API context with user gesture initialization in web/src/services/audio/AudioService.ts
- [ ] T044 [US1] Create MediaElementAudioSourceNode from <audio> element in web/src/services/audio/AudioService.ts
- [ ] T045 [US1] Implement playback control methods (play, pause, seek, getPosition) in web/src/services/audio/AudioService.ts
- [ ] T046 [US1] Implement progress tracking with setInterval in web/src/hooks/usePlayer.ts

### US1 - EQ Implementation (Mobile - Web Audio API polyfill or native modules)

- [ ] T047 [US1] Create 10-band BiquadFilterNode chain for Web Audio API in web/src/services/audio/EqualizerService.ts
- [ ] T048 [US1] Implement EQ frequency configuration [31, 62, 125, 250, 500, 1k, 2k, 4k, 8k, 16k] Hz with Q=1.0 in web/src/services/audio/EqualizerService.ts
- [ ] T049 [US1] Implement real-time EQ gain adjustment using setTargetAtTime() in web/src/services/audio/EqualizerService.ts
- [ ] T050 [US1] Create EQPreset entity with built-in presets (流行, 摇滚, 古典, 人声, 电子) in shared/types/entities.ts
- [ ] T051 [P] [US1] Implement EQ preset management (load, save, delete) in app/src/services/storage/EQPresetStorage.ts
- [ ] T052 [P] [US1] Implement EQ preset management (load, save, delete) in web/src/services/storage/EQPresetStorage.ts

### US1 - UI Screens (Mobile)

- [ ] T053 [US1] Create HomeScreen with "创建房间" and "加入房间" buttons in app/src/screens/HomeScreen.tsx
- [ ] T054 [US1] Create SearchScreen with NetEase API search and results list in app/src/screens/SearchScreen.tsx
- [ ] T055 [US1] Create PlayerScreen with album cover, track info, progress bar, playback controls in app/src/screens/PlayerScreen.tsx
- [ ] T056 [US1] Create EQScreen with 10 vertical sliders and preset selector in app/src/screens/EQScreen.tsx
- [ ] T057 [P] [US1] Implement progress bar with drag-to-seek functionality in app/src/components/player/ProgressBar.tsx
- [ ] T058 [P] [US1] Implement playback control buttons (play/pause, next, previous) in app/src/components/player/PlaybackControls.tsx
- [ ] T059 [P] [US1] Implement EQ slider component with real-time value display in app/src/components/eq/EQSlider.tsx

### US1 - UI Screens (Web)

- [ ] T060 [P] [US1] Create HomeScreen with "创建房间" and "加入房间" buttons in web/src/screens/HomeScreen.tsx
- [ ] T061 [P] [US1] Create SearchScreen with NetEase API search and results list in web/src/screens/SearchScreen.tsx
- [ ] T062 [P] [US1] Create PlayerScreen with album cover, track info, progress bar, playback controls in web/src/screens/PlayerScreen.tsx
- [ ] T063 [P] [US1] Create EQScreen with 10 vertical sliders and preset selector in web/src/screens/EQScreen.tsx
- [ ] T064 [P] [US1] Implement progress bar with drag-to-seek functionality in web/src/components/player/ProgressBar.tsx
- [ ] T065 [P] [US1] Implement playback control buttons (play/pause, next, previous) in web/src/components/player/PlaybackControls.tsx
- [ ] T066 [P] [US1] Implement EQ slider component with real-time value display in web/src/components/eq/EQSlider.tsx

### US1 - Local Storage & Preferences

- [ ] T067 [P] [US1] Implement LocalPreferences entity storage (theme, EQ settings, history) in app/src/services/storage/PreferencesStorage.ts
- [ ] T068 [P] [US1] Implement LocalPreferences entity storage (theme, EQ settings, history) in web/src/services/storage/PreferencesStorage.ts
- [ ] T069 [P] [US1] Implement playback history management (max 100 tracks, FIFO) in app/src/services/storage/HistoryStorage.ts
- [ ] T070 [P] [US1] Implement playback history management (max 100 tracks, FIFO) in web/src/services/storage/HistoryStorage.ts
- [ ] T071 [P] [US1] Implement theme switching (dark/light/system) in app/src/hooks/useTheme.ts
- [ ] T072 [P] [US1] Implement theme switching (dark/light/system) in web/src/hooks/useTheme.ts

### US1 - Integration & Polish

- [ ] T073 [US1] Connect SearchScreen to MusicService API in app/src/screens/SearchScreen.tsx
- [ ] T074 [US1] Connect PlayerScreen to AudioService playback controls in app/src/screens/PlayerScreen.tsx
- [ ] T075 [US1] Connect EQScreen to EqualizerService and PreferencesStorage in app/src/screens/EQScreen.tsx
- [ ] T076 [US1] Add loading states and error handling for API calls in app/src/components/common/LoadingSpinner.tsx
- [ ] T077 [US1] Add Toast notifications for errors and confirmations in app/src/components/common/Toast.tsx
- [ ] T078 [P] [US1] Implement audio URL expiry handling with proactive refresh (5min before expiry) in app/src/services/audio/PlayerService.ts

**Checkpoint**: User Story 1 complete - Users can play music with EQ on single device independently

---

## Phase 4: User Story 2 - 多设备创建/加入房间同步播放 (Priority: P2)

**Goal**: Users can create/join rooms and sync playback across multiple devices with < 50ms accuracy

**Independent Test**: Device A creates room, Device B joins with room code, Device A plays music, verify Device B syncs within 50ms. Test pause, seek, and reconnection scenarios.

### US2 - Backend Room Management

- [ ] T079 [US2] Implement room creation with 6-digit code generation in backend/src/services/room/RoomManager.ts
- [ ] T080 [US2] Implement room join validation and member addition in backend/src/services/room/RoomManager.ts
- [ ] T081 [US2] Implement room leave and cleanup (24h TTL, empty room deletion) in backend/src/services/room/RoomManager.ts
- [ ] T082 [US2] Implement host transfer logic when host leaves in backend/src/services/room/RoomManager.ts
- [ ] T083 [P] [US2] Implement room capacity limit enforcement (max 50 members) in backend/src/services/room/RoomManager.ts

### US2 - Backend Sync Engine

- [ ] T084 [US2] Implement time sync handler (NTP-like) with round-trip delay calculation in backend/src/services/sync/TimeSyncService.ts
- [ ] T085 [US2] Implement sync state broadcast for play/pause/seek events in backend/src/services/sync/SyncEngine.ts
- [ ] T086 [US2] Implement Last-Write-Wins conflict resolution with version numbers in backend/src/services/sync/SyncEngine.ts
- [ ] T087 [US2] Implement heartbeat tracking and member timeout detection (60s) in backend/src/services/sync/SyncEngine.ts

### US2 - Socket.io Event Handlers (Backend)

- [ ] T088 [P] [US2] Implement room:create handler in backend/src/handlers/roomHandlers.ts
- [ ] T089 [P] [US2] Implement room:join handler with broadcast to existing members in backend/src/handlers/roomHandlers.ts
- [ ] T090 [P] [US2] Implement room:leave handler with member cleanup in backend/src/handlers/roomHandlers.ts
- [ ] T091 [P] [US2] Implement sync:play handler with state broadcast in backend/src/handlers/syncHandlers.ts
- [ ] T092 [P] [US2] Implement sync:pause handler with state broadcast in backend/src/handlers/syncHandlers.ts
- [ ] T093 [P] [US2] Implement sync:seek handler with state broadcast in backend/src/handlers/syncHandlers.ts
- [ ] T094 [P] [US2] Implement time:sync_request handler with timestamp response in backend/src/handlers/syncHandlers.ts

### US2 - Frontend Sync Client (Mobile)

- [ ] T095 [US2] Implement Socket.io connection with auto-reconnect (1s-5s delays, max 5 attempts) in app/src/services/sync/SocketManager.ts
- [ ] T096 [US2] Implement time offset calculation using NTP-like algorithm (median of 10 samples) in app/src/services/sync/TimeSyncService.ts
- [ ] T097 [US2] Implement periodic time sync (every 30 seconds) in app/src/services/sync/TimeSyncService.ts
- [ ] T098 [US2] Implement drift detection loop (every 100ms) in app/src/services/sync/DriftMonitor.ts
- [ ] T099 [US2] Implement soft sync strategy (50-100ms drift, playback rate ±5%) in app/src/services/sync/SyncController.ts
- [ ] T100 [US2] Implement hard sync strategy (>100ms drift, seek with 50ms crossfade) in app/src/services/sync/SyncController.ts
- [ ] T101 [US2] Implement expected position calculation using server timestamp in app/src/services/sync/SyncController.ts

### US2 - Frontend Sync Client (Web)

- [ ] T102 [P] [US2] Implement Socket.io connection with auto-reconnect in web/src/services/sync/SocketManager.ts
- [ ] T103 [P] [US2] Implement time offset calculation using NTP-like algorithm in web/src/services/sync/TimeSyncService.ts
- [ ] T104 [P] [US2] Implement periodic time sync (every 30 seconds) in web/src/services/sync/TimeSyncService.ts
- [ ] T105 [P] [US2] Implement drift detection loop (every 100ms) in web/src/services/sync/DriftMonitor.ts
- [ ] T106 [P] [US2] Implement soft sync strategy (50-100ms drift, playback rate ±5%) in web/src/services/sync/SyncController.ts
- [ ] T107 [P] [US2] Implement hard sync strategy (>100ms drift, seek with fade) in web/src/services/sync/SyncController.ts
- [ ] T108 [P] [US2] Implement expected position calculation using server timestamp in web/src/services/sync/SyncController.ts

### US2 - Socket.io Event Emitters (Mobile)

- [ ] T109 [P] [US2] Implement room creation flow in app/src/services/sync/RoomService.ts
- [ ] T110 [P] [US2] Implement room join flow with room code input in app/src/services/sync/RoomService.ts
- [ ] T111 [P] [US2] Implement playback event emission (play, pause, seek) in app/src/services/sync/SyncService.ts
- [ ] T112 [P] [US2] Handle sync:state broadcast and apply to local player in app/src/services/sync/SyncService.ts

### US2 - Socket.io Event Emitters (Web)

- [ ] T113 [P] [US2] Implement room creation flow in web/src/services/sync/RoomService.ts
- [ ] T114 [P] [US2] Implement room join flow with room code input in web/src/services/sync/RoomService.ts
- [ ] T115 [P] [US2] Implement playback event emission (play, pause, seek) in web/src/services/sync/SyncService.ts
- [ ] T116 [P] [US2] Handle sync:state broadcast and apply to local player in web/src/services/sync/SyncService.ts

### US2 - UI Updates (Mobile)

- [ ] T117 [US2] Update HomeScreen with room creation dialog (generate code, show loading) in app/src/screens/HomeScreen.tsx
- [ ] T118 [US2] Update HomeScreen with room join dialog (6-digit input, validation) in app/src/screens/HomeScreen.tsx
- [ ] T119 [US2] Create RoomScreen to display room code, member count, member list in app/src/screens/RoomScreen.tsx
- [ ] T120 [US2] Add connection status indicator (green/yellow/red dot) to PlayerScreen in app/src/components/player/ConnectionStatus.tsx
- [ ] T121 [P] [US2] Add member list display with avatars and usernames in app/src/components/room/MemberList.tsx
- [ ] T122 [P] [US2] Add reconnection handling with Toast notification in app/src/services/sync/SocketManager.ts

### US2 - UI Updates (Web)

- [ ] T123 [P] [US2] Update HomeScreen with room creation dialog in web/src/screens/HomeScreen.tsx
- [ ] T124 [P] [US2] Update HomeScreen with room join dialog in web/src/screens/HomeScreen.tsx
- [ ] T125 [P] [US2] Create RoomScreen to display room code, member count, member list in web/src/screens/RoomScreen.tsx
- [ ] T126 [P] [US2] Add connection status indicator to PlayerScreen in web/src/components/player/ConnectionStatus.tsx
- [ ] T127 [P] [US2] Add member list display with avatars and usernames in web/src/components/room/MemberList.tsx
- [ ] T128 [P] [US2] Add reconnection handling with Toast notification in web/src/services/sync/SocketManager.ts

### US2 - Integration & Testing

- [ ] T129 [US2] Connect RoomScreen to RoomService for creation/join in app/src/screens/RoomScreen.tsx
- [ ] T130 [US2] Connect PlayerScreen playback controls to SyncService (emit events) in app/src/screens/PlayerScreen.tsx
- [ ] T131 [US2] Test multi-device sync with 2 devices (iOS Simulator + Android Emulator) - measure drift with console logs
- [ ] T132 [US2] Add error handling for room not found, room full scenarios in app/src/services/sync/RoomService.ts
- [ ] T133 [US2] Add offline queue for playback events (send when reconnected) in app/src/services/sync/SocketManager.ts

**Checkpoint**: User Story 2 complete - Multi-device sync works with < 50ms accuracy

---

## Phase 5: User Story 3 - 播放列表共享与协作控制 (Priority: P3)

**Goal**: Room members can collaboratively manage a shared playlist, with optional host-only mode

**Independent Test**: Multiple users in room add songs, reorder playlist, skip tracks. Test host-only mode restrictions.

### US3 - Backend Playlist Management

- [ ] T134 [US3] Implement playlist add handler (validate track, append to room.playlist) in backend/src/services/room/PlaylistManager.ts
- [ ] T135 [US3] Implement playlist remove handler with index validation in backend/src/services/room/PlaylistManager.ts
- [ ] T136 [US3] Implement playlist reorder handler with bounds checking in backend/src/services/room/PlaylistManager.ts
- [ ] T137 [US3] Implement next/previous track handlers with auto-play in backend/src/services/room/PlaylistManager.ts
- [ ] T138 [P] [US3] Implement control mode switching (open ↔ host-only) in backend/src/services/room/RoomManager.ts
- [ ] T139 [P] [US3] Implement permission checking middleware for host-only mode in backend/src/middleware/permissions.ts

### US3 - Socket.io Event Handlers (Backend)

- [ ] T140 [P] [US3] Implement sync:playlist_add handler with broadcast in backend/src/handlers/playlistHandlers.ts
- [ ] T141 [P] [US3] Implement sync:playlist_remove handler with broadcast in backend/src/handlers/playlistHandlers.ts
- [ ] T142 [P] [US3] Implement sync:playlist_reorder handler with broadcast in backend/src/handlers/playlistHandlers.ts
- [ ] T143 [P] [US3] Implement sync:next handler with track change and state broadcast in backend/src/handlers/syncHandlers.ts
- [ ] T144 [P] [US3] Implement sync:previous handler with track change in backend/src/handlers/syncHandlers.ts
- [ ] T145 [P] [US3] Implement room:control_mode_changed handler with broadcast in backend/src/handlers/roomHandlers.ts

### US3 - Frontend Playlist State (Mobile)

- [ ] T146 [US3] Extend RoomStore with playlist array and currentTrackIndex in app/src/stores/roomStore.ts
- [ ] T147 [US3] Implement playlist add action in store in app/src/stores/roomStore.ts
- [ ] T148 [US3] Implement playlist remove action in store in app/src/stores/roomStore.ts
- [ ] T149 [US3] Implement playlist reorder action in store in app/src/stores/roomStore.ts
- [ ] T150 [P] [US3] Handle sync:playlist_updated broadcast and update store in app/src/services/sync/PlaylistSyncService.ts

### US3 - Frontend Playlist State (Web)

- [ ] T151 [P] [US3] Extend RoomStore with playlist array and currentTrackIndex in web/src/stores/roomStore.ts
- [ ] T152 [P] [US3] Implement playlist add action in store in web/src/stores/roomStore.ts
- [ ] T153 [P] [US3] Implement playlist remove action in store in web/src/stores/roomStore.ts
- [ ] T154 [P] [US3] Implement playlist reorder action in store in web/src/stores/roomStore.ts
- [ ] T155 [P] [US3] Handle sync:playlist_updated broadcast and update store in web/src/services/sync/PlaylistSyncService.ts

### US3 - UI Components (Mobile)

- [ ] T156 [US3] Create PlaylistScreen with scrollable track list in app/src/screens/PlaylistScreen.tsx
- [ ] T157 [US3] Implement drag-to-reorder for playlist items using react-native-draggable-flatlist in app/src/components/playlist/DraggablePlaylist.tsx
- [ ] T158 [US3] Implement "Add to Playlist" button in SearchScreen in app/src/screens/SearchScreen.tsx
- [ ] T159 [US3] Implement "Remove from Playlist" long-press action in app/src/components/playlist/PlaylistItem.tsx
- [ ] T160 [US3] Create control mode toggle switch (host only) in app/src/screens/RoomScreen.tsx
- [ ] T161 [P] [US3] Add permission indicator ("仅房主可操作") in UI when in host-only mode in app/src/components/room/PermissionBanner.tsx
- [ ] T162 [P] [US3] Disable playlist controls for non-hosts in host-only mode in app/src/screens/PlaylistScreen.tsx

### US3 - UI Components (Web)

- [ ] T163 [P] [US3] Create PlaylistScreen with scrollable track list in web/src/screens/PlaylistScreen.tsx
- [ ] T164 [P] [US3] Implement drag-to-reorder for playlist items using react-beautiful-dnd in web/src/components/playlist/DraggablePlaylist.tsx
- [ ] T165 [P] [US3] Implement "Add to Playlist" button in SearchScreen in web/src/screens/SearchScreen.tsx
- [ ] T166 [P] [US3] Implement "Remove from Playlist" context menu in web/src/components/playlist/PlaylistItem.tsx
- [ ] T167 [P] [US3] Create control mode toggle switch (host only) in web/src/screens/RoomScreen.tsx
- [ ] T168 [P] [US3] Add permission indicator ("仅房主可操作") in UI when in host-only mode in web/src/components/room/PermissionBanner.tsx
- [ ] T169 [P] [US3] Disable playlist controls for non-hosts in host-only mode in web/src/screens/PlaylistScreen.tsx

### US3 - Integration & Error Handling

- [ ] T170 [US3] Connect PlaylistScreen to PlaylistSyncService for add/remove/reorder in app/src/screens/PlaylistScreen.tsx
- [ ] T171 [US3] Connect Next/Previous buttons to sync:next/previous events in app/src/components/player/PlaybackControls.tsx
- [ ] T172 [US3] Add permission denied error handling with Toast in app/src/services/sync/PlaylistSyncService.ts
- [ ] T173 [US3] Test control mode switching with multiple users (verify permissions) in app/
- [ ] T174 [US3] Add optimistic UI updates for playlist operations (revert on failure) in app/src/stores/roomStore.ts

**Checkpoint**: User Story 3 complete - Collaborative playlist management works

---

## Phase 6: User Story 4 - HRTF 空间音效增强 (Priority: P4 - Future Enhancement)

**Goal**: Advanced spatial audio with HRTF and reverb effects for immersive experience

**Independent Test**: After P1 audio engine is stable, enable spatial audio toggle and verify 3D sound effects with headphones.

**Note**: P4 is deferred post-MVP. Tasks below are placeholders for future implementation.

### US4 - Spatial Audio Research & Planning

- [ ] T175 [US4] Research HRTF libraries for Web Audio API (e.g., Resonance Audio, web-audio-api-hrtf)
- [ ] T176 [US4] Research native iOS Audio Unit for HRTF implementation
- [ ] T177 [US4] Research Android Oboe library for low-latency spatial audio
- [ ] T178 [US4] Benchmark CPU usage of HRTF processing on target devices (aim < 15% total)
- [ ] T179 [US4] Design quality degradation strategy for low-end devices

### US4 - Implementation (Deferred)

- [ ] T180 [US4] Implement Web Audio API HRTF using PannerNode + ConvolverNode in web/src/services/audio/SpatialAudioService.ts
- [ ] T181 [US4] Implement reverb presets (演唱会, 音乐厅, 小房间) using ConvolverNode in web/src/services/audio/ReverbService.ts
- [ ] T182 [US4] Create native iOS module for HRTF audio processing (if needed) in app/ios/RNTSpatialAudio/
- [ ] T183 [US4] Create native Android module for HRTF audio processing (if needed) in app/android/app/src/main/java/com/musictogether/SpatialAudio/
- [ ] T184 [US4] Create SpatialAudioScreen with effect toggles and preset selector in app/src/screens/SpatialAudioScreen.tsx
- [ ] T185 [US4] Add performance monitoring to detect CPU > 15% and show warning in app/src/services/audio/PerformanceMonitor.ts

**Checkpoint**: User Story 4 deferred - Not required for MVP

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

### Documentation

- [ ] T186 [P] Update README.md with project overview, setup instructions, and architecture diagram
- [ ] T187 [P] Create API documentation for REST endpoints in docs/api.md
- [ ] T188 [P] Create Socket.io event documentation in docs/websocket.md
- [ ] T189 [P] Add inline code comments for complex algorithms (time sync, drift detection) in backend/src/services/sync/

### Code Quality

- [ ] T190 Code cleanup: Remove console.log statements, unused imports, commented code
- [ ] T191 Refactoring: Extract magic numbers to constants (e.g., SOFT_SYNC_THRESHOLD_MS = 50)
- [ ] T192 Run ESLint fix across all projects (backend, app, web, shared)
- [ ] T193 Run Prettier format across all projects
- [ ] T194 [P] Add TSDoc comments to public API methods in backend/src/services/

### Performance Optimization

- [ ] T195 Profile EQ audio processing CPU usage on iOS (target < 15%) using Xcode Instruments
- [ ] T196 Profile EQ audio processing CPU usage on Android (target < 15%) using Android Profiler
- [ ] T197 Optimize Socket.io message size (send trackIds instead of full Track objects when possible)
- [ ] T198 Implement debouncing for progress updates (max 2 updates/second) in app/src/services/sync/SyncService.ts
- [ ] T199 Add lazy loading for album cover images with react-native-fast-image in app/src/components/player/AlbumCover.tsx

### Testing (Optional but Recommended)

- [ ] T200 [P] Add unit tests for time sync algorithm in backend/tests/unit/TimeSyncService.test.ts
- [ ] T201 [P] Add unit tests for drift detection algorithm in app/tests/unit/DriftMonitor.test.ts
- [ ] T202 [P] Add unit tests for soft/hard sync logic in app/tests/unit/SyncController.test.ts
- [ ] T203 [P] Add integration tests for Socket.io room creation flow in backend/tests/integration/room.test.ts
- [ ] T204 [P] Add integration tests for playlist management in backend/tests/integration/playlist.test.ts
- [ ] T205 Add E2E test for single-device playback (User Story 1) using Detox in app/tests/e2e/singleDevicePlayback.e2e.ts
- [ ] T206 Add E2E test for multi-device sync (User Story 2) - requires 2 simulators in app/tests/e2e/multiDeviceSync.e2e.ts

### Security & Validation

- [ ] T207 Add input validation for all Socket.io events (room codes, track IDs, user IDs) in backend/src/middleware/validation.ts
- [ ] T208 Add rate limiting per socket connection (10 events/second) in backend/src/middleware/rateLimiter.ts
- [ ] T209 Add room capacity enforcement with error responses in backend/src/services/room/RoomManager.ts
- [ ] T210 Add audio URL expiry validation and automatic refresh in app/src/services/audio/PlayerService.ts

### Final Validation

- [ ] T211 Run through quickstart.md on fresh machine to verify setup instructions
- [ ] T212 Test cold start time on mobile (target < 2 seconds) - optimize if needed
- [ ] T213 Test memory usage during playback (target < 200MB) - optimize if needed
- [ ] T214 Verify sync accuracy with audio analysis tool (target < 50ms drift)
- [ ] T215 Test network disconnection/reconnection scenarios (5s disconnect, verify recovery)
- [ ] T216 Test edge cases: room expiry (24h), member timeout (60s), audio URL expiry (20min)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Story 1 (Phase 3)**: Depends on Foundational phase completion
- **User Story 2 (Phase 4)**: Depends on Foundational + US1 audio engine
- **User Story 3 (Phase 5)**: Depends on Foundational + US2 room infrastructure
- **User Story 4 (Phase 6)**: Depends on US1 audio engine (DEFERRED)
- **Polish (Phase 7)**: Depends on desired user stories being complete

### User Story Dependencies

```
Foundational (Phase 2)
    ↓
User Story 1 (P1) ← MVP CORE
    ↓
User Story 2 (P2) ← Adds multi-device sync (depends on US1 audio engine)
    ↓
User Story 3 (P3) ← Adds playlist collaboration (depends on US2 room infrastructure)
    ↓
User Story 4 (P4) ← Deferred (depends on US1 audio engine)
```

### MVP Recommendation

**MVP = Phase 1 + Phase 2 + Phase 3 (User Story 1 only)**
- Single-device playback with EQ
- NetEase API integration
- Local storage and preferences
- **Estimated**: 3-4 weeks (2 developers)

**Full P1-P3 = MVP + Phase 4 + Phase 5**
- Multi-device sync
- Collaborative playlist
- **Estimated**: 6-8 weeks (2 developers)

### Parallel Opportunities

#### Setup Phase (Phase 1)
All tasks marked [P] can run in parallel:
- T003, T004, T005, T006, T007, T008, T009 (8 parallel tasks)

#### Foundational Phase (Phase 2)
Backend and Frontend work can run in parallel:
- Backend: T010-T017 (can run in parallel with Frontend)
- Frontend Mobile: T018, T020, T022, T024, T026, T028 (can run in parallel)
- Frontend Web: T019, T021, T023, T025, T027, T029 (can run in parallel)

#### Within Each User Story
Mobile and Web implementations can run in parallel throughout all phases.

Example for User Story 1:
- Backend (T030-T035) → Mobile (T036-T078) + Web (T043-T078) in parallel

---

## Execution Example: 2-Developer Team

### Week 1-2: Setup + Foundation
- Dev 1: Backend foundation (T001-T017)
- Dev 2: Frontend foundation (T018-T029) for both mobile and web

### Week 3-5: User Story 1 (MVP)
- Dev 1: Backend API (T030-T035) + Mobile audio engine (T036-T042)
- Dev 2: Web audio engine (T043-T046) + EQ implementation (T047-T052)

### Week 4-5: User Story 1 UI
- Dev 1: Mobile UI screens (T053-T066)
- Dev 2: Web UI screens (T060-T066) + local storage (T067-T072)

### Week 6: User Story 1 Integration
- Both: Integration, testing, bug fixes (T073-T078)

**MVP DELIVERY** ✅

### Week 7-8: User Story 2 (Multi-device Sync)
- Dev 1: Backend sync engine (T079-T094)
- Dev 2: Frontend sync clients (T095-T116)

### Week 8-9: User Story 2 UI & Testing
- Both: UI updates (T117-T128), integration, multi-device testing (T129-T133)

### Week 10: User Story 3 (Playlist Collaboration)
- Dev 1: Backend playlist (T134-T145) + Frontend state (T146-T155)
- Dev 2: Frontend UI (T156-T169) + integration (T170-T174)

### Week 11-12: Polish & Delivery
- Both: Documentation, testing, optimization, final validation (T186-T216)

**FULL P1-P3 DELIVERY** 🚀

---

## Task Statistics

- **Total Tasks**: 216
- **Setup**: 9 tasks
- **Foundational**: 20 tasks
- **User Story 1 (P1)**: 49 tasks ⭐ MVP
- **User Story 2 (P2)**: 55 tasks
- **User Story 3 (P3)**: 41 tasks
- **User Story 4 (P4)**: 11 tasks (deferred)
- **Polish**: 31 tasks

**Parallel Tasks**: 142 tasks marked [P] can run in parallel with other tasks

**MVP Scope (P1 only)**: 78 tasks (Setup + Foundation + US1)
**Full P1-P3 Scope**: 174 tasks (excluding P4 and some polish tasks)

---

**Version**: 1.0.0  
**Generated**: 2026-01-02  
**Ready for**: Implementation - Start with Phase 1 Setup tasks!
