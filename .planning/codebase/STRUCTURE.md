# Codebase Structure

**Analysis Date:** 2026-02-14

## Directory Layout

```
musesync/
├── app/                          # React Native mobile/web frontend (Expo)
│   ├── src/
│   │   ├── components/           # UI components
│   │   │   ├── common/           # Shared components (ConnectionStatus, LoadingSpinner, Toast, MiniPlayer)
│   │   │   ├── player/           # Player-specific components
│   │   │   └── ui/               # Base UI components (Button, Card, Input)
│   │   ├── screens/              # Screen components (7 screens)
│   │   ├── services/             # Business logic services
│   │   │   ├── audio/            # Audio playback (platform-specific)
│   │   │   ├── api/              # External API clients
│   │   │   ├── storage/          # Local storage (AsyncStorage/LocalStorage)
│   │   │   └── sync/             # Real-time sync services
│   │   ├── stores/               # React Context state management
│   │   ├── hooks/                # Custom React hooks
│   │   ├── navigation/           # React Navigation setup
│   │   └── constants/            # App constants (theme, etc.)
│   ├── App.tsx                   # Root component
│   ├── index.ts                  # Entry point
│   ├── app.config.ts             # Expo configuration
│   └── package.json
│
├── backend/                      # Node.js Express + Socket.io server
│   ├── src/
│   │   ├── services/             # Business logic
│   │   │   ├── room/             # Room management (RoomManager, RoomStore)
│   │   │   ├── sync/             # Sync engine (SyncEngine, TimeSyncService)
│   │   │   └── music/            # Music API integration
│   │   ├── handlers/             # Socket.io event handlers
│   │   │   ├── roomHandlers.ts   # Room lifecycle events
│   │   │   └── syncHandlers.ts   # Playback sync events
│   │   ├── routes/               # REST API routes
│   │   │   └── music.ts          # Music search endpoints
│   │   ├── middleware/           # Express middleware
│   │   │   └── rateLimiter.ts    # Rate limiting
│   │   └── server.ts             # Main server entry point
│   └── package.json
│
├── shared/                       # Shared types and constants
│   ├── types/                    # TypeScript type definitions
│   │   ├── entities.ts           # Core entities (Room, Track, User, SyncState, etc.)
│   │   ├── socket-events.ts      # Socket.io event types
│   │   ├── api.ts                # API response types
│   │   └── index.ts              # Type exports
│   ├── constants/                # Shared constants
│   │   ├── colors.ts             # Color palette
│   │   └── index.ts              # Config constants
│   ├── dist/                     # Compiled TypeScript (generated)
│   └── package.json
│
├── .planning/                    # GSD planning documents
│   └── codebase/                 # Architecture analysis
│
├── .specify/                     # Design system specs
├── .vscode/                      # VS Code settings
├── .yarn/                        # Yarn package manager
├── package.json                  # Root workspace config
├── yarn.lock                     # Dependency lock file
├── .oxlintrc.json                # Oxlint configuration
├── .oxfmtrc.json                 # Oxfmt configuration
└── .gitignore
```

## Directory Purposes

**app/src/components/common:**
- Purpose: Reusable UI components used across multiple screens
- Contains: ConnectionStatus (network indicator), LoadingSpinner (loading state), PlayIcon (play button), Toast (notifications), MiniPlayer (compact player)
- Key files: `ConnectionStatus.tsx`, `LoadingSpinner.tsx`, `Toast.tsx`, `MiniPlayer.tsx`

**app/src/components/player:**
- Purpose: Player-specific UI components
- Contains: Player controls and display components
- Key files: `MiniPlayer.tsx`

**app/src/components/ui:**
- Purpose: Base UI components following design system
- Contains: Button, Card, Input components
- Key files: `Button.tsx`, `Card.tsx`, `Input.tsx`

**app/src/screens:**
- Purpose: Full-screen components representing app pages
- Contains: 7 screens - HomeScreen (main), RoomScreen (collaborative), PlayerScreen (full player), SearchScreen (music search), EQScreen (equalizer), HistoryScreen (play history), SettingsScreen (preferences)
- Key files: `HomeScreen.tsx`, `RoomScreen.tsx`, `PlayerScreen.tsx`, `SearchScreen.tsx`, `EQScreen.tsx`, `HistoryScreen.tsx`, `SettingsScreen.tsx`

**app/src/services/audio:**
- Purpose: Audio playback abstraction layer
- Contains: Platform-specific implementations (Web Audio API, React Native Track Player)
- Key files: `AudioService.ts` (facade), `WebAudioService.ts`, `NativeAudioService.ts`, `TrackPlayerService.ts`, `EqualizerService.ts`

**app/src/services/api:**
- Purpose: External API clients
- Contains: Netease Cloud Music API integration
- Key files: `MusicApi.ts`

**app/src/services/storage:**
- Purpose: Local persistent storage
- Contains: AsyncStorage (mobile) / LocalStorage (web) wrappers
- Key files: `EQPresetStorage.ts`, `HistoryStorage.ts`, `PlaybackStateStorage.ts`, `RoomStateStorage.ts`, `PreferencesStorage.ts`

**app/src/services/sync:**
- Purpose: Real-time synchronization services
- Contains: Socket.io connection, room sync, playback sync, time sync
- Key files: `SocketManager.ts`, `SyncService.ts`, `RoomService.ts`, `TimeSyncService.ts`

**app/src/stores:**
- Purpose: Global state management using React Context
- Contains: Four context providers with hooks
- Key files: `index.tsx` (all providers)

**app/src/hooks:**
- Purpose: Custom React hooks for common logic
- Contains: Player hooks, theme hooks
- Key files: `usePlayer.ts`, `useTheme.ts`

**app/src/navigation:**
- Purpose: Screen routing configuration
- Contains: React Navigation stack setup with 7 screens
- Key files: `AppNavigator.tsx`

**app/src/constants:**
- Purpose: App-level constants
- Contains: Theme configuration
- Key files: `theme.ts`

**backend/src/services/room:**
- Purpose: Room lifecycle and state management
- Contains: Business logic (RoomManager) and in-memory storage (RoomStore)
- Key files: `RoomManager.ts`, `RoomStore.ts`

**backend/src/services/sync:**
- Purpose: Playback synchronization and time sync
- Contains: Conflict resolution, state broadcasting, NTP-like time sync
- Key files: `SyncEngine.ts`, `TimeSyncService.ts`

**backend/src/services/music:**
- Purpose: Music API integration
- Contains: Netease Cloud Music API wrapper
- Key files: `MusicService.ts`

**backend/src/handlers:**
- Purpose: Socket.io event handlers
- Contains: Room lifecycle handlers, sync handlers
- Key files: `roomHandlers.ts`, `syncHandlers.ts`

**backend/src/routes:**
- Purpose: REST API endpoints
- Contains: Music search and metadata endpoints
- Key files: `music.ts`

**backend/src/middleware:**
- Purpose: Express middleware
- Contains: Rate limiting
- Key files: `rateLimiter.ts`

**shared/types:**
- Purpose: Shared TypeScript type definitions
- Contains: Entity types, Socket event types, API types
- Key files: `entities.ts`, `socket-events.ts`, `api.ts`, `index.ts`

**shared/constants:**
- Purpose: Shared configuration constants
- Contains: Room config, validation rules, error codes, network config
- Key files: `index.ts`, `colors.ts`

## Key File Locations

**Entry Points:**
- `app/App.tsx`: Root React component with StoreProvider
- `app/index.ts`: Expo entry point
- `backend/src/server.ts`: Express + Socket.io server

**Configuration:**
- `app/app.config.ts`: Expo app configuration
- `backend/src/server.ts`: Server configuration (port, CORS, Socket.io options)
- `shared/constants/index.ts`: Shared configuration constants

**Core Logic:**
- `backend/src/services/room/RoomManager.ts`: Room business logic
- `backend/src/services/sync/SyncEngine.ts`: Sync state management
- `app/src/services/sync/SocketManager.ts`: Client WebSocket connection
- `app/src/stores/index.tsx`: Global state management

**Testing:**
- Not detected

## Naming Conventions

**Files:**
- Services: `[Domain]Service.ts` (e.g., `AudioService.ts`, `RoomService.ts`)
- Stores/Managers: `[Domain]Store.ts` or `[Domain]Manager.ts` (e.g., `RoomStore.ts`, `RoomManager.ts`)
- Handlers: `[Domain]Handlers.ts` (e.g., `roomHandlers.ts`, `syncHandlers.ts`)
- Routes: `[domain].ts` (e.g., `music.ts`)
- Components: PascalCase with `.tsx` extension (e.g., `HomeScreen.tsx`, `MiniPlayer.tsx`)
- Hooks: `use[Feature].ts` (e.g., `usePlayer.ts`, `useTheme.ts`)
- Types: `[domain].ts` (e.g., `entities.ts`, `socket-events.ts`)

**Directories:**
- Feature-based: `services/[feature]/`, `components/[category]/`
- Lowercase with hyphens: `audio/`, `storage/`, `sync/`

## Where to Add New Code

**New Feature:**
- Primary code: `backend/src/services/[feature]/` for business logic, `app/src/services/[feature]/` for client logic
- Types: `shared/types/[feature].ts` or add to existing type files
- Socket events: Add to `shared/types/socket-events.ts`
- Handlers: `backend/src/handlers/[feature]Handlers.ts`
- Screens: `app/src/screens/[Feature]Screen.tsx`

**New Component/Module:**
- UI Component: `app/src/components/[category]/[Component].tsx`
- Service: `app/src/services/[domain]/[Service].ts` or `backend/src/services/[domain]/[Service].ts`
- Store/Context: Add provider to `app/src/stores/index.tsx`

**Utilities:**
- Shared helpers: `shared/constants/` or create `shared/utils/`
- Client helpers: `app/src/hooks/` for React hooks, or create `app/src/utils/`
- Server helpers: Create `backend/src/utils/` as needed

## Special Directories

**app/android:**
- Purpose: Native Android build artifacts
- Generated: Yes (by Expo Prebuild)
- Committed: No (in .gitignore)

**app/.expo:**
- Purpose: Expo cache and web build artifacts
- Generated: Yes (by Expo CLI)
- Committed: No (in .gitignore)

**backend/node_modules:**
- Purpose: Installed dependencies
- Generated: Yes (by yarn)
- Committed: No (in .gitignore)

**shared/dist:**
- Purpose: Compiled TypeScript output
- Generated: Yes (by TypeScript compiler)
- Committed: No (in .gitignore)

**.planning/codebase:**
- Purpose: GSD architecture analysis documents
- Generated: Yes (by GSD mapper)
- Committed: Yes

---

*Structure analysis: 2026-02-14*
