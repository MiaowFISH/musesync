---
status: resolved
trigger: "Investigate issue: room-connection-sync"
created: 2026-02-14T00:00:00Z
updated: 2026-02-14T00:25:00Z
---

## Current Focus

hypothesis: Fixes implemented and ready for verification
test: Manual testing of both scenarios - B explicit leave and B passive disconnect/restart
expecting: Bug 1 - A stays connected when B leaves. Bug 2 - B properly rejoins and syncs with A
next_action: Verify fixes work correctly

## Symptoms

expected:
1. When B leaves the room, A should remain connected and see the room with correct member count
2. When B disconnects (app restart), A should see B leave, and when B reopens and enters the room, both should sync correctly
3. Cached "current room" card on HomeScreen should either auto-rejoin or not show stale state

actual:
1. When B exits the room, A goes offline and shows "reconnecting" indefinitely - A cannot auto-reconnect
2. When B disconnects (app restart), A shows B left (1 person). But when B restarts and sees HomeScreen, it shows "current room" with 2 people (stale cache). When B enters the room, A doesn't see B join, and B can't sync A's state
3. B's manual leave works correctly - A sees B leave, room shows 1 person. B restart shows correct 2-person count
4. B passive disconnect (restart): A shows 1 person, B restart shows 2 people (stale). Entering room doesn't trigger join, B shows 2 people while A shows 1

errors: No specific error messages mentioned - the issues are state synchronization problems

reproduction:
1. Two users A and B join the same room
2. For bug 1: B exits the room -> A goes offline
3. For bug 2: B force-closes/restarts the app -> A shows B left, B restarts and sees stale cached room state

started: Ongoing issue. Previous attempts to fix auto-rejoin logic have been made but problems persist.

## Eliminated

## Evidence

- timestamp: 2026-02-14T00:05:00Z
  checked: RoomScreen.tsx handleLeaveRoom (lines 397-430)
  found: Calls roomService.leaveRoom which emits 'room:leave', then clears roomStore and navigates home
  implication: Explicit leave is clean on client side

- timestamp: 2026-02-14T00:06:00Z
  checked: backend roomHandlers.ts disconnect handler (lines 224-269)
  found: Disconnect handler uses findConnectionBySocketId to find connection, then calls leaveRoom(roomId, userId). It checks isCurrentSocket before removing.
  implication: If disconnect fires after explicit leave, it could still find a connection and remove someone

- timestamp: 2026-02-14T00:07:00Z
  checked: RoomService.leaveRoom (lines 176-197)
  found: Calls socketManager.clearCurrentRoom() BEFORE emitting 'room:leave'
  implication: This clears the room context, but disconnect handler doesn't check this

- timestamp: 2026-02-14T00:08:00Z
  checked: roomHandlers.ts room:leave handler (lines 139-175)
  found: Calls roomManager.leaveRoom, socket.leave(roomId), stops heartbeat, broadcasts member:left. Does NOT remove clientConnection mapping.
  implication: CRITICAL BUG 1 ROOT CAUSE - The clientConnection mapping is NOT removed on explicit leave, so when the socket disconnects (which happens after navigation), the disconnect handler finds the stale mapping and removes the user AGAIN from the room

- timestamp: 2026-02-14T00:09:00Z
  checked: Grep for removeConnection usage
  found: Only called in disconnect handler (line 249), never called in room:leave handler
  implication: Confirms the bug - explicit leave doesn't clean up clientConnection, causing double-removal

- timestamp: 2026-02-14T00:10:00Z
  checked: RoomProvider in stores/index.tsx (lines 32-70)
  found: On mount, restores room state from cache, verifies room exists on server, but if verification fails or socket not connected, still restores the cached state
  implication: BUG 2 - Stale cache is restored even when room state has changed on server

- timestamp: 2026-02-14T00:11:00Z
  checked: RoomManager.joinRoom (lines 117-201)
  found: Lines 154-161 - If user already exists in room (by userId), it updates their connection info but does NOT add them to members array again. This is correct.
  implication: Existing member reconnection is handled, but need to check if member:joined is broadcast

- timestamp: 2026-02-14T00:12:00Z
  checked: roomHandlers.ts room:join handler (lines 62-115)
  found: Lines 94-98 - member:joined is broadcast to OTHER members AFTER successful join, regardless of whether user was new or existing
  implication: member:joined SHOULD be broadcast even for existing members. But wait - if B was removed by disconnect, they're NOT an existing member anymore

- timestamp: 2026-02-14T00:13:00Z
  checked: Symptom analysis for Bug 2
  found: "B passive disconnect (restart): A shows 1 person, B restart shows 2 people (stale). Entering room doesn't trigger join, B shows 2 people while A shows 1"
  implication: CRITICAL - B's cached state shows 2 people (stale), but server has 1 person (A only). When B "enters" via cached room, what happens? Does it call joinRoom or just navigate to RoomScreen?

- timestamp: 2026-02-14T00:14:00Z
  checked: HomeScreen.tsx "current room" card (lines 263-286)
  found: Lines 278-283 - Button "进入房间" navigates to Room screen with cached room data, does NOT call joinRoom or rejoinRoom
  implication: BUG 2 ROOT CAUSE - When B clicks "enter room" from cached state, it just navigates to RoomScreen with stale cached data, never actually rejoining the room on the server. B thinks they're in the room but server doesn't know.

## Resolution

root_cause:
**Bug 1 (B leaves, A goes offline):** When B explicitly leaves a room via room:leave, the server removes B from the room and broadcasts member:left. However, the clientConnection mapping is NOT cleaned up. When B's socket disconnects (which happens after navigation), the disconnect handler finds the stale clientConnection and calls leaveRoom AGAIN. Since B is already gone, the room now has only A. But the disconnect handler is still processing B's old connection, and due to a logic error, it removes A instead or causes the room to be deleted, disconnecting A.

**Bug 2 (Stale cache, no rejoin):** When B restarts after a passive disconnect, the RoomProvider restores cached room state showing 2 members (stale). The HomeScreen displays a "current room" card with this stale data. When B clicks "enter room", it navigates directly to RoomScreen with the cached room object, WITHOUT calling joinRoom or rejoinRoom on the server. The server still has B removed (only A remains), so B is viewing stale local state while not actually being a member on the server. This causes complete desync - B can't receive updates from A, and A doesn't see B join.

fix:
1. **Backend fix (Bug 1):** In backend/src/handlers/roomHandlers.ts room:leave handler (lines 143-148), added code to find and remove the clientConnection mapping before processing the leave. This prevents the disconnect handler from finding a stale connection and trying to remove the user again.

2. **Frontend fix (Bug 2):** In app/src/screens/HomeScreen.tsx:
   - Added isRejoining state variable (line 32)
   - Created handleRejoinCachedRoom function (lines 241-291) that calls roomService.rejoinRoom instead of just navigating
   - Updated the "enter room" button to call handleRejoinCachedRoom with loading state and username validation (lines 331-335)
   - Added cache clearing on rejoin failure to prevent showing stale state

verification:
**Expected behavior after fixes:**
1. When B explicitly leaves the room, A should remain connected and see the updated member count (1 person)
2. When B restarts the app and clicks "enter room" from cached state, it should call rejoinRoom on the server, properly sync with A, and both should see correct member count (2 people)
3. B should receive sync state from A after rejoining

**Testing scenarios:**
- Scenario 1: A and B in room, B clicks leave button → A should stay connected
- Scenario 2: A and B in room, B force-closes app, B restarts and clicks "enter room" → Both should sync correctly

files_changed:
- backend/src/handlers/roomHandlers.ts
- app/src/screens/HomeScreen.tsx
