---
phase: 01-bug-fixes-foundation
plan: 02
status: completed
started: 2026-02-14
completed: 2026-02-14
commit: 76fa500
---

## Summary

Fixed BUGF-02 backend: Replaced socket.id-based user identification with persistent clientId tracking.

### What was done

1. **Shared types** — Added `clientId: string` to `User` interface. Added `clientId` to `RoomCreateRequest` and `RoomJoinRequest`. Created `RoomRejoinRequest` and `RoomStateSnapshot` types. Added `room:rejoin` and `room:state_snapshot` to `SocketEvents`.

2. **RoomManager** — Added `ClientConnection` tracking with `clientConnections` Map. Implemented `handleReconnection()` with 2.5s grace period for old sockets and 3s batch reconnection window. Added `getFullStateSnapshot()`, `findConnectionBySocketId()`, `isCurrentSocket()`, and `removeConnection()` methods. Updated `createRoom`/`joinRoom` to set `clientId` on User objects.

3. **Room handlers** — Updated `room:create` and `room:join` to call `handleReconnection()` for connection mapping. Added `room:rejoin` handler that verifies membership, handles reconnection, and sends full state snapshot. Replaced disconnect handler with clientId-based lookup instead of scanning all rooms. Updated `registerRoomHandlers` to accept `io` parameter.

4. **Server** — Updated `registerRoomHandlers(socket, io)` call to pass io instance.

### Verification

- `room:rejoin` handler exists and sends `room:state_snapshot`
- `room:create` and `room:join` call `handleReconnection`
- Disconnect handler uses `findConnectionBySocketId` instead of room scan
- Backend type-check passes (no new errors)
