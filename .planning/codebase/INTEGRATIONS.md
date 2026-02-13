# External Integrations

**Analysis Date:** 2026-02-14

## APIs & External Services

**Music Streaming:**
- NetEase Cloud Music - Primary music source for search, metadata, and audio URLs
  - SDK/Client: `@neteasecloudmusicapienhanced/api` 4.29.20
  - Implementation: `backend/src/services/music/MusicService.ts`
  - Methods: `cloudsearch()`, `song_detail()`, `lyric()`, `song_url()`
  - Auth: No explicit auth required (public API)

## Data Storage

**Databases:**
- None detected - In-memory storage only

**In-Memory Storage:**
- Room state: `backend/src/services/room/RoomStore.ts` (Map-based)
- Music cache: `backend/src/services/music/MusicService.ts` (Map-based, 24-hour TTL)
- Audio URL cache: 20-minute TTL (expires before NetEase URL expiry)

**Local Storage (Client):**
- AsyncStorage via `@react-native-async-storage/async-storage`
- Implementation: `app/src/services/storage/PreferencesStorage.ts`
- Stores: API URL, user preferences

**File Storage:**
- Local filesystem only - No cloud storage integration

**Caching:**
- In-memory cache with TTL-based expiry
- Search results: 24-hour cache
- Song details: 24-hour cache
- Lyrics: 24-hour cache
- Audio URLs: 20-minute cache

## Authentication & Identity

**Auth Provider:**
- Custom/None - No authentication system implemented
- Users identified by Socket.io connection ID only
- No user accounts or login required

## Real-time Communication

**WebSocket Server:**
- Socket.io 4.6.1 on backend
- Configuration: `backend/src/server.ts`
  - Transports: WebSocket + polling fallback
  - Ping interval: 25 seconds
  - Ping timeout: 60 seconds
  - Max buffer size: 1MB

**WebSocket Client:**
- Socket.io-client 4.8.3 on frontend
- Configuration: `app/src/services/sync/SocketManager.ts`
  - Transports: WebSocket + polling fallback
  - Reconnection: Enabled with exponential backoff
  - Max reconnect attempts: 5
  - Reconnect delay: 1-5 seconds (configurable via `NETWORK_CONFIG`)

**Socket Events:**
- Room events: `room:create`, `room:join`, `room:leave`, `room:update`
- Sync events: `sync:play`, `sync:pause`, `sync:seek`, `sync:time-sync`
- See `shared/types/socket-events.ts` for full event definitions

## Monitoring & Observability

**Error Tracking:**
- None detected - Console logging only

**Logs:**
- Console-based logging with prefixes: `[SocketManager]`, `[MusicService]`, `[SERVER]`, `[WS]`
- Request logging: HTTP method, path, status code, duration
- No persistent logging infrastructure

**Health Checks:**
- `GET /api/health` endpoint returns status, uptime, service health
- TODO: Implement actual NetEase API health check

## CI/CD & Deployment

**Hosting:**
- Not configured - Development setup only

**CI Pipeline:**
- None detected

**Build System:**
- Turbo for monorepo task orchestration
- Expo CLI for app builds
- Expo Prebuild for native code generation

## Environment Configuration

**Required env vars:**
- `EXPO_PUBLIC_API_URL` - Frontend API endpoint (optional, defaults to `http://localhost:3000`)
- `PORT` - Backend server port (optional, defaults to 3000)
- `CORS_ORIGIN` - CORS allowed origins (optional, defaults to `*`)
- `NODE_ENV` - Environment mode (optional, defaults to development)

**Secrets location:**
- No secrets management detected
- `.env` file not present in repository
- Environment variables passed via process.env

## Webhooks & Callbacks

**Incoming:**
- None detected

**Outgoing:**
- None detected

## Network Configuration

**Client-side:**
- Reconnection delay: `NETWORK_CONFIG.RECONNECT_DELAY_MS` (default 1000ms)
- Reconnection delay max: `NETWORK_CONFIG.RECONNECT_DELAY_MAX_MS` (default 5000ms)
- Request timeout: `NETWORK_CONFIG.REQUEST_TIMEOUT_MS` (default 10000ms)
- Configuration: `shared/constants/index.ts`

**Server-side:**
- CORS enabled with configurable origin
- Request body limit: 1MB (Express default)
- Socket.io max buffer: 1MB

## Audio Streaming

**Quality Levels:**
- Standard: 128 kbps
- High: 192 kbps
- Extra High: 320 kbps (default)
- Lossless: 999 kbps

**Audio URL Expiry:**
- NetEase URLs expire after ~20 minutes
- Client caches for 20 minutes with refresh capability
- Trial/VIP restrictions tracked via `freeTrialInfo`

---

*Integration audit: 2026-02-14*
