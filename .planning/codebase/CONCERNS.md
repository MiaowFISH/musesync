# Codebase Concerns

**Analysis Date:** 2026-02-14

## Tech Debt

**In-Memory Room Storage:**
- Issue: `RoomStore` uses in-memory Map for all room state with no persistence layer
- Files: `backend/src/services/room/RoomStore.ts`, `backend/src/services/room/RoomManager.ts`
- Impact: All room data lost on server restart; cannot scale horizontally across multiple instances; no data recovery
- Fix approach: Replace with Redis or persistent database. Implement connection pooling and failover logic. Add data serialization for room state snapshots.

**Incomplete NetEase API Integration:**
- Issue: MusicService has placeholder implementations and incomplete error handling for NetEase Cloud Music API
- Files: `backend/src/services/music/MusicService.ts` (lines 21, 485)
- Impact: Health checks always return 'ok' without actual verification; API failures may not be caught properly
- Fix approach: Implement actual NetEase API health check with timeout and retry logic. Add circuit breaker pattern for API failures.

**Unimplemented Health Checks:**
- Issue: Server health endpoint returns hardcoded 'ok' status without verifying service dependencies
- Files: `backend/src/server.ts` (line 102)
- Impact: Cannot detect service degradation; load balancers may route traffic to unhealthy instances
- Fix approach: Implement actual health checks for NetEase API, cache layer, and database connections with timeout handling.

**In-Memory Cache Without Bounds:**
- Issue: MusicService cache uses unbounded Map that grows indefinitely
- Files: `backend/src/services/music/MusicService.ts` (lines 24, 514-530)
- Impact: Memory leak over time; cache cleanup runs every minute but doesn't prevent growth between cleanups
- Fix approach: Implement LRU cache with maximum size limit. Add memory monitoring and alerts. Consider Redis for distributed caching.

## Known Bugs

**Version Increment Logic Flaw:**
- Issue: SyncEngine increments version on every update, but resets to 0 on new track (line 96)
- Files: `backend/src/services/sync/SyncEngine.ts` (lines 82-96)
- Impact: Version tracking becomes unreliable; clients may accept stale updates after track changes
- Trigger: Play new track, then pause/seek rapidly
- Workaround: None; requires server-side fix

**Heartbeat Timeout Not Enforced:**
- Issue: Member timeout detection runs but doesn't actively remove timed-out members from room
- Files: `backend/src/services/sync/SyncEngine.ts` (lines 142-175)
- Impact: Timed-out members remain in room.members array; can cause sync issues and incorrect member counts
- Trigger: Member disconnects without sending leave event; wait 10+ minutes
- Workaround: Manually leave room or refresh connection

**Socket ID Update Race Condition:**
- Issue: Socket ID updated after room join, but sync state sent before update completes
- Files: `backend/src/handlers/roomHandlers.ts` (lines 68-84)
- Impact: New member may receive sync state with incorrect sender identification
- Trigger: Join room while host is actively playing
- Workaround: Reconnect to room

**Type Safety Issues with `any`:**
- Issue: Multiple handler functions use `any` type for request/callback parameters
- Files: `backend/src/handlers/roomHandlers.ts` (lines 216, 254), `backend/src/routes/music.ts` (line 78), `app/src/services/sync/SocketManager.ts` (line 214)
- Impact: Loss of type checking; potential runtime errors from malformed requests
- Fix approach: Create proper TypeScript interfaces for all request/response types; remove all `any` casts

## Security Considerations

**CORS Configured to Accept All Origins:**
- Risk: Wildcard CORS origin allows any website to make requests to the API
- Files: `backend/src/server.ts` (lines 24, 58-59)
- Current mitigation: None; relies on environment variable
- Recommendations: Implement whitelist of allowed origins; validate origin header; add CSRF protection for state-changing operations

**No Input Validation on Socket Events:**
- Risk: Socket handlers accept unvalidated data from clients
- Files: `backend/src/handlers/roomHandlers.ts` (lines 216, 254), `backend/src/handlers/syncHandlers.ts` (all handlers)
- Current mitigation: Basic room existence checks only
- Recommendations: Add schema validation for all socket event payloads; implement rate limiting per user; add request signing

**Rate Limiter Uses IP Address Only:**
- Risk: Can be bypassed with proxy rotation; no per-user rate limiting
- Files: `backend/src/middleware/rateLimiter.ts` (lines 101-114)
- Current mitigation: Attempts to read X-Forwarded-For header
- Recommendations: Implement per-user rate limiting using authentication tokens; add distributed rate limiting for multi-instance deployments

**No Authentication on Socket Events:**
- Risk: Any connected client can emit events for any room/user
- Files: `backend/src/handlers/roomHandlers.ts`, `backend/src/handlers/syncHandlers.ts`
- Current mitigation: Only checks if user is host for control operations
- Recommendations: Add JWT or session-based authentication; validate userId matches authenticated user; implement permission checks

**Sensitive Data in Logs:**
- Risk: Console logs may contain user IDs, room IDs, and track information
- Files: Multiple files with `console.log` statements throughout codebase
- Current mitigation: None
- Recommendations: Implement structured logging with log levels; sanitize sensitive data; use logging service instead of console

## Performance Bottlenecks

**Inefficient Room Lookup on Disconnect:**
- Problem: Iterates through all rooms and all members to find disconnected socket
- Files: `backend/src/handlers/roomHandlers.ts` (lines 177-210)
- Cause: No index mapping socket ID to room/user
- Improvement path: Maintain socket ID → (roomId, userId) map; update on connect/disconnect

**Unbounded Heartbeat Timers:**
- Problem: Heartbeat timers stored in Map without cleanup on room deletion
- Files: `backend/src/services/sync/SyncEngine.ts` (lines 14, 194-206)
- Cause: Cleanup only called on explicit room leave, not on timeout
- Improvement path: Implement automatic timer cleanup; add timer count monitoring

**Cache Cleanup Runs Every Minute:**
- Problem: Full cache scan every 60 seconds blocks event loop
- Files: `backend/src/services/music/MusicService.ts` (line 28)
- Cause: Synchronous iteration over all cache entries
- Improvement path: Use TTL-based expiration with lazy deletion; implement background worker thread

**No Connection Pooling for NetEase API:**
- Problem: Each request creates new connection to NetEase API
- Files: `backend/src/services/music/MusicService.ts` (lines 61, 164, 265, 354)
- Cause: Direct API calls without connection reuse
- Improvement path: Implement HTTP client with connection pooling; add request queuing

## Fragile Areas

**Sync State Version Management:**
- Files: `backend/src/services/sync/SyncEngine.ts`, `backend/src/services/room/RoomManager.ts`
- Why fragile: Version increments on every update but resets on track change; Last-Write-Wins conflict resolution doesn't handle concurrent updates well
- Safe modification: Add comprehensive tests for version tracking; implement vector clocks for true causality tracking
- Test coverage: No unit tests for conflict resolution logic

**Room Member State Consistency:**
- Files: `backend/src/services/room/RoomManager.ts`, `backend/src/handlers/roomHandlers.ts`
- Why fragile: Member state (connectionState, lastSeenAt, socketId) updated in multiple places without transactions
- Safe modification: Implement state machine for member lifecycle; add validation before state transitions
- Test coverage: No integration tests for member join/leave/disconnect scenarios

**Socket.io Event Ordering:**
- Files: `backend/src/handlers/roomHandlers.ts`, `backend/src/handlers/syncHandlers.ts`
- Why fragile: No guarantee of event delivery order; sync state broadcast may arrive before member:joined event
- Safe modification: Add sequence numbers to events; implement client-side event queue with ordering
- Test coverage: No tests for concurrent event scenarios

**Cache Expiry Logic:**
- Files: `backend/src/services/music/MusicService.ts` (lines 496-508)
- Why fragile: Manual expiry check on every cache access; no atomic operations
- Safe modification: Use Map with automatic expiry; implement cache invalidation strategy
- Test coverage: No tests for cache expiry edge cases

## Scaling Limits

**Single-Instance In-Memory Storage:**
- Current capacity: Limited by server RAM; typical ~10,000 rooms with 5 members each
- Limit: Server restart loses all data; cannot distribute load across instances
- Scaling path: Migrate to Redis for distributed state; implement session persistence; add load balancer with sticky sessions

**Unbounded Cache Growth:**
- Current capacity: Depends on available memory; no maximum size enforced
- Limit: Memory exhaustion after extended operation
- Scaling path: Implement LRU eviction; set maximum cache size; use Redis for distributed cache

**Linear Room Lookup on Disconnect:**
- Current capacity: O(n*m) where n=rooms, m=members per room
- Limit: Noticeable latency at 1000+ rooms
- Scaling path: Implement socket ID index; use hash map for O(1) lookup

**Heartbeat Timer Accumulation:**
- Current capacity: One timer per active user; no cleanup on timeout
- Limit: Memory leak with 10,000+ concurrent users
- Scaling path: Implement timer pool; add automatic cleanup; use event-based timeout instead of intervals

## Dependencies at Risk

**NetEase Cloud Music API Dependency:**
- Risk: External API with no SLA; may change endpoints or authentication; rate limits not documented
- Impact: Search, audio URL, and lyrics features break if API changes
- Migration plan: Implement adapter pattern for music provider; add fallback providers; cache aggressively

**Socket.io Version Compatibility:**
- Risk: Socket.io 4.x has breaking changes from 3.x; client/server version mismatch causes connection failures
- Impact: Mobile app may fail to connect if server upgrades
- Migration plan: Pin versions in package.json; test client/server compatibility before deployment; implement version negotiation

## Missing Critical Features

**No Persistent User Sessions:**
- Problem: User data lost on server restart; no way to resume room after disconnect
- Blocks: Reliable room rejoining; user history; offline mode

**No Message Queue for Sync Events:**
- Problem: Sync events sent directly without guarantee of delivery
- Blocks: Reliable playback synchronization; offline event queuing

**No Distributed Locking:**
- Problem: No mechanism to prevent concurrent modifications to room state
- Blocks: Horizontal scaling; multi-instance deployments

**No Audit Logging:**
- Problem: No record of who changed what and when
- Blocks: Debugging issues; compliance requirements; user support

## Test Coverage Gaps

**No Unit Tests for Sync Engine:**
- What's not tested: Version tracking, conflict resolution, heartbeat logic, member timeout
- Files: `backend/src/services/sync/SyncEngine.ts`
- Risk: Sync bugs go undetected; regressions introduced silently
- Priority: High

**No Integration Tests for Room Operations:**
- What's not tested: Create room → join → play → seek → leave flow; member join/leave during playback
- Files: `backend/src/handlers/roomHandlers.ts`, `backend/src/handlers/syncHandlers.ts`
- Risk: Race conditions and state inconsistencies not caught
- Priority: High

**No Tests for Cache Expiry:**
- What's not tested: Cache TTL enforcement, expired entry cleanup, concurrent access
- Files: `backend/src/services/music/MusicService.ts`
- Risk: Cache corruption or memory leaks undetected
- Priority: Medium

**No Tests for Error Scenarios:**
- What's not tested: NetEase API failures, network timeouts, malformed requests
- Files: `backend/src/services/music/MusicService.ts`, `backend/src/handlers/`
- Risk: Error handling code never executed; failures cause crashes
- Priority: High

**No E2E Tests for Playback Sync:**
- What's not tested: Multi-client synchronization, latency compensation, seek accuracy
- Files: `app/src/services/sync/`, `backend/src/services/sync/`
- Risk: Sync issues only discovered in production
- Priority: High

---

*Concerns audit: 2026-02-14*
