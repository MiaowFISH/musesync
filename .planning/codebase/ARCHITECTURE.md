# Architecture

**Analysis Date:** 2026-02-14

## Pattern Overview

**Overall:** Client-Server with Real-time Synchronization

This is a distributed music synchronization system using a monorepo structure with three workspaces: a React Native mobile/web frontend (`app`), a Node.js backend (`backend`), and shared type definitions (`shared`). The architecture emphasizes real-time state synchronization across multiple clients in collaborative rooms using WebSocket communication.

**Key Characteristics:**
- Multi-platform support (iOS, Android, Web) via Expo and React Native
- Real-time bidirectional communication via Socket.io
- Optimistic concurrency control with Last-Write-Wins conflict resolution
- Platform-specific audio implementations (Web Audio API vs native)
- In-memory room state with automatic cleanup
- Type-safe event contracts between client and server

## Layers

**Presentation Layer:**
- Purpose: User interface and navigation
- Location: `app/src/screens/`, `app/src/components/`
- Contains: Screen components (HomeScreen, RoomScreen, PlayerScreen, SearchScreen, EQScreen, HistoryScreen, SettingsScreen), UI components (Button, Card, Input), common components (ConnectionStatus, LoadingSpinner, Toast, MiniPlayer)
- Depends on: Store layer, Services layer
- Used by: Navigation layer

**Navigation Layer:**
- Purpose: Screen routing and navigation state
- Location: `app/src/navigation/AppNavigator.tsx`
- Contains: React Navigation stack configuration with 7 screens
- Depends on: Presentation layer
- Used by: App entry point

**State Management Layer:**
- Purpose: Global state management using React Context
- Location: `app/src/stores/index.tsx`
- Contains: Four context providers (RoomProvider, PlayerProvider, PreferencesProvider, ConnectionProvider) with hooks (useRoomStore, usePlayerStore, usePreferencesStore, useConnectionStore)
- Depends on: Storage services, Sync services
- Used by: Presentation layer, Services layer

**Services Layer (Client):**
- Purpose: Business logic and external integrations
- Location: `app/src/services/`
- Contains:
  - Audio services: `AudioService.ts` (platform abstraction), `WebAudioService.ts`, `NativeAudioService.ts`, `TrackPlayerService.ts`, `EqualizerService.ts`
  - Sync services: `SocketManager.ts` (WebSocket connection), `SyncService.ts`, `RoomService.ts`, `TimeSyncService.ts`
  - API services: `MusicApi.ts` (Netease Cloud Music API)
  - Storage services: `EQPresetStorage.ts`, `HistoryStorage.ts`, `PlaybackStateStorage.ts`, `RoomStateStorage.ts`, `PreferencesStorage.ts`
- Depends on: Shared types, External APIs
- Used by: State management layer, Presentation layer

**Services Layer (Server):**
- Purpose: Backend business logic and room management
- Location: `backend/src/services/`
- Contains:
  - Room services: `RoomManager.ts` (business logic), `RoomStore.ts` (in-memory storage)
  - Sync services: `SyncEngine.ts` (state broadcasting, conflict resolution), `TimeSyncService.ts` (NTP-like time synchronization)
  - Music services: `MusicService.ts` (Netease API integration)
- Depends on: Shared types, Socket.io
- Used by: Handlers layer

**Handlers Layer (Server):**
- Purpose: Socket.io event handling
- Location: `backend/src/handlers/`
- Contains: `roomHandlers.ts` (room lifecycle), `syncHandlers.ts` (playback sync)
- Depends on: Services layer
- Used by: Server entry point

**Routes Layer (Server):**
- Purpose: REST API endpoints
- Location: `backend/src/routes/music.ts`
- Contains: Music search and metadata endpoints
- Depends on: Services layer
- Used by: Server entry point

**Shared Layer:**
- Purpose: Type definitions and constants shared between client and server
- Location: `shared/types/`, `shared/constants/`
- Contains: Entity types (Room, Track, User, SyncState, EQPreset, LocalPreferences), Socket event types, validation utilities, constants
- Depends on: Nothing
- Used by: All layers

## Data Flow

**Room Creation Flow:**

1. Client calls `roomService.createRoom()` → emits `room:create` event
2. Server receives in `roomHandlers.ts` → calls `roomManager.createRoom()`
3. `RoomManager` validates input, generates room ID, creates initial `SyncState`, stores in `RoomStore`
4. Server emits `room:created` response with Room object
5. Client receives response, stores in `RoomProvider` context, persists to `RoomStateStorage`

**Playback Synchronization Flow:**

1. Host client calls `syncService.play()` → emits `sync:play` event with track ID and seek time
2. Server receives in `syncHandlers.ts` → creates new `SyncState` object
3. `SyncEngine.handleSyncUpdate()` performs Last-Write-Wins check using version numbers
4. If valid, updates room state in `RoomStore` and broadcasts `sync:state` event to all room members
5. All clients receive `sync:state` → update `PlayerProvider` context → trigger audio playback via `AudioService`
6. Clients send periodic `sync:heartbeat` events to maintain connection state

**Time Synchronization Flow:**

1. Client sends `time:sync_request` with client timestamp (t0)
2. Server receives, records server receive time (t1) and send time (t2)
3. Server responds with t0, t1, t2
4. Client receives, records client receive time (t3)
5. Client calculates latency = (t3 - t0) / 2 and time offset = ((t1 - t0) + (t2 - t3)) / 2
6. Client stores latency and timeOffset in user state for sync adjustments

**State Management:**

- Client state is split across four contexts: Room (collaborative state), Player (playback state), Preferences (user settings), Connection (network state)
- Room state is persisted to AsyncStorage/LocalStorage via `RoomStateStorage` for reconnection recovery
- Player state is persisted to `PlaybackStateStorage` for session continuity
- Server state is in-memory in `RoomStore` with automatic cleanup of inactive rooms after timeout
- Sync state uses optimistic concurrency control: each update increments version number, stale updates are rejected

## Key Abstractions

**AudioService (Platform Abstraction):**
- Purpose: Unified audio interface across Web and Native platforms
- Examples: `app/src/services/audio/AudioService.ts`, `app/src/services/audio/WebAudioService.ts`, `app/src/services/audio/NativeAudioService.ts`
- Pattern: Strategy pattern - selects implementation at runtime based on `Platform.OS`
- Methods: play(), pause(), resume(), seek(), setVolume(), setPlaybackRate(), onProgress(), onEnd()

**SocketManager (Connection Management):**
- Purpose: Centralized Socket.io connection with automatic reconnection
- Examples: `app/src/services/sync/SocketManager.ts`
- Pattern: Singleton with state listeners
- Features: Automatic reconnection with exponential backoff, connection state tracking, type-safe event emission/listening

**RoomManager (Business Logic):**
- Purpose: Room lifecycle and member management
- Examples: `backend/src/services/room/RoomManager.ts`
- Pattern: Service layer with validation
- Methods: createRoom(), joinRoom(), leaveRoom(), updateSyncState(), canControl()

**SyncEngine (Conflict Resolution):**
- Purpose: Broadcast sync state and resolve concurrent updates
- Examples: `backend/src/services/sync/SyncEngine.ts`
- Pattern: Last-Write-Wins with version numbers
- Features: Heartbeat monitoring, member timeout detection, selective broadcasting

**RoomStore (In-Memory Storage):**
- Purpose: Ephemeral room state storage
- Examples: `backend/src/services/room/RoomStore.ts`
- Pattern: Map-based in-memory cache with TTL cleanup
- Note: TODO comment indicates future migration to Redis for horizontal scaling

## Entry Points

**Client Entry Point:**
- Location: `app/App.tsx`
- Triggers: App launch
- Responsibilities: Wraps app with StoreProvider (all context providers), renders AppNavigator, renders ToastContainer

**Client Initialization:**
- Location: `app/index.ts`
- Triggers: Expo entry point
- Responsibilities: Registers root component

**Server Entry Point:**
- Location: `backend/src/server.ts`
- Triggers: `npm start` or `npm run dev`
- Responsibilities: Creates Express app, sets up Socket.io server, registers event handlers, mounts REST routes, starts HTTP server on port 3000

**Socket.io Connection Handler:**
- Location: `backend/src/server.ts` lines 72-84
- Triggers: Client connects via WebSocket
- Responsibilities: Logs connection, registers room handlers, registers sync handlers, handles disconnect

## Error Handling

**Strategy:** Layered error handling with type-safe error responses

**Patterns:**

- **Validation Errors:** Input validation in `RoomManager` returns error responses with code and message (e.g., `INVALID_REQUEST`, `ROOM_NOT_FOUND`)
- **Permission Errors:** `SyncEngine.handleSyncUpdate()` checks `canControl()` before allowing state changes, returns `PermissionDeniedError`
- **Rate Limiting:** Middleware in `backend/src/middleware/rateLimiter.ts` returns `RateLimitError` with retry-after
- **Network Errors:** `SocketManager` catches connection errors, logs details, triggers reconnection with exponential backoff
- **Async Errors:** Try-catch blocks in all Socket.io handlers with callback error responses
- **Global Error Handler:** Express middleware at `backend/src/server.ts` lines 126-135 catches unhandled errors, returns 500 with sanitized message

## Cross-Cutting Concerns

**Logging:** Console-based logging with prefixes (`[SocketManager]`, `[SyncEngine]`, `[RoomManager]`) for traceability

**Validation:**
- Client-side: Type guards in `shared/types/socket-events.ts` (isRoomCreateRequest, isSyncPlayRequest, etc.)
- Server-side: Input validation in `RoomManager` methods with error responses
- Shared: Validators object in `shared/types/entities.ts` for username, EQ bands, volume, playback rate

**Authentication:** Device-based identification via `deviceId` and `userId` in requests; no token-based auth currently implemented

**Concurrency Control:** Last-Write-Wins with version numbers in `SyncState`; stale updates rejected by `SyncEngine`

**Time Synchronization:** NTP-like protocol in `TimeSyncService` to calculate client-server time offset and latency for accurate sync

---

*Architecture analysis: 2026-02-14*
