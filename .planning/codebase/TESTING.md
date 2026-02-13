# Testing Patterns

**Analysis Date:** 2026-02-14

## Test Framework

**Runner:**
- Not detected - No test runner configured in project
- No test files found in source directories (only in node_modules)

**Assertion Library:**
- Not detected

**Run Commands:**
- Not applicable - testing infrastructure not yet implemented

## Test File Organization

**Location:**
- Not established - No test files in codebase

**Naming:**
- Recommended pattern (not yet implemented): `*.test.ts`, `*.test.tsx`, `*.spec.ts`, `*.spec.tsx`

**Structure:**
- Recommended approach: Co-located with source files
- Example structure (not yet implemented):
```
src/
├── services/
│   ├── room/
│   │   ├── RoomManager.ts
│   │   └── RoomManager.test.ts
│   └── sync/
│       ├── SyncEngine.ts
│       └── SyncEngine.test.ts
├── components/
│   ├── ui/
│   │   ├── Button.tsx
│   │   └── Button.test.tsx
```

## Test Structure

**Suite Organization:**
- Not yet implemented in codebase
- Recommended pattern based on code structure:

```typescript
describe('RoomManager', () => {
  describe('createRoom', () => {
    it('should create a room with valid request', () => {
      // Test implementation
    });

    it('should reject invalid username', () => {
      // Test implementation
    });
  });

  describe('joinRoom', () => {
    it('should allow user to join existing room', () => {
      // Test implementation
    });

    it('should reject join if room is full', () => {
      // Test implementation
    });
  });
});
```

**Patterns:**
- Setup: Initialize test data and mocks before each test
- Teardown: Clean up resources after each test
- Assertion: Use clear, descriptive assertion messages

## Mocking

**Framework:**
- Not yet configured - Recommended: vitest with built-in mocking

**Patterns:**
- Recommended approach for Socket.io mocking:
```typescript
// Mock Socket.io events
const mockSocket = {
  on: vi.fn(),
  emit: vi.fn(),
  join: vi.fn(),
  leave: vi.fn(),
  to: vi.fn().mockReturnValue({
    emit: vi.fn(),
    except: vi.fn().mockReturnValue({ emit: vi.fn() }),
  }),
};
```

- Recommended approach for service mocking:
```typescript
// Mock RoomManager
vi.mock('../services/room/RoomManager', () => ({
  roomManager: {
    createRoom: vi.fn(),
    joinRoom: vi.fn(),
    getRoom: vi.fn(),
  },
}));
```

**What to Mock:**
- External services (Socket.io, HTTP clients)
- Database/storage operations
- Time-dependent operations (use vi.useFakeTimers())
- Network requests

**What NOT to Mock:**
- Core business logic (RoomManager, SyncEngine)
- Type definitions and interfaces
- Utility functions and validators
- Pure functions

## Fixtures and Factories

**Test Data:**
- Recommended factory pattern (not yet implemented):

```typescript
// factories/roomFactory.ts
export function createMockRoom(overrides?: Partial<Room>): Room {
  return {
    roomId: '123456',
    hostId: 'user-1',
    members: [createMockUser()],
    playlist: [],
    currentTrack: null,
    currentTrackIndex: -1,
    syncState: createMockSyncState(),
    controlMode: 'host-only',
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
    ...overrides,
  };
}

export function createMockUser(overrides?: Partial<User>): User {
  return {
    userId: 'user-1',
    username: 'Test User',
    deviceId: 'device-1',
    deviceType: 'web',
    socketId: 'socket-1',
    connectionState: 'connected',
    joinedAt: Date.now(),
    lastSeenAt: Date.now(),
    latency: 0,
    timeOffset: 0,
    ...overrides,
  };
}

export function createMockSyncState(overrides?: Partial<SyncState>): SyncState {
  return {
    trackId: null,
    status: 'stopped',
    seekTime: 0,
    serverTimestamp: Date.now(),
    playbackRate: 1.0,
    volume: 1.0,
    updatedBy: 'user-1',
    version: 0,
    ...overrides,
  };
}
```

**Location:**
- Recommended: `src/__tests__/factories/` or `src/__fixtures__/`

## Coverage

**Requirements:**
- Not enforced - No coverage configuration detected

**Recommended targets:**
- Services: 80%+ coverage
- Components: 70%+ coverage
- Utilities: 90%+ coverage

**View Coverage:**
- Recommended command (not yet configured): `vitest --coverage`

## Test Types

**Unit Tests:**
- Scope: Individual functions and methods
- Approach: Test business logic in isolation
- Examples to test:
  - `RoomManager.createRoom()` - validation, room creation, error handling
  - `RoomManager.joinRoom()` - room lookup, member addition, capacity checks
  - `SyncEngine.handleSyncUpdate()` - version checking, conflict resolution
  - Validators in `shared/types/entities.ts` - all validation functions

**Integration Tests:**
- Scope: Multiple services working together
- Approach: Test Socket.io event flow with mocked socket
- Examples to test:
  - Room creation flow: `room:create` event → RoomManager → Socket.io broadcast
  - Sync state updates: `sync:update` event → SyncEngine → broadcast to room
  - Member join flow: `room:join` event → RoomManager → heartbeat start → broadcast

**E2E Tests:**
- Framework: Not used
- Recommended: Playwright or Cypress for full app testing
- Would test: Complete user flows like create room → join room → play music → sync

## Common Patterns

**Async Testing:**
- Recommended pattern (not yet implemented):
```typescript
it('should handle async room creation', async () => {
  const request: RoomCreateRequest = {
    userId: 'user-1',
    username: 'Test User',
    deviceId: 'device-1',
    deviceType: 'web',
  };

  const result = await roomManager.createRoom(request);

  expect(result.success).toBe(true);
  expect(result.room).toBeDefined();
  expect(result.room?.roomId).toMatch(/^\d{6}$/);
});
```

**Error Testing:**
- Recommended pattern (not yet implemented):
```typescript
it('should reject invalid username', () => {
  const request: RoomCreateRequest = {
    userId: 'user-1',
    username: '', // Invalid: empty
    deviceId: 'device-1',
    deviceType: 'web',
  };

  const result = roomManager.createRoom(request);

  expect(result.success).toBe(false);
  expect(result.error?.code).toBe(ERROR_CODES.INVALID_REQUEST);
  expect(result.error?.message).toContain('Username');
});
```

**Socket.io Event Testing:**
- Recommended pattern (not yet implemented):
```typescript
it('should handle room:create event', (done) => {
  const mockSocket = createMockSocket();
  const callback = vi.fn();

  registerRoomHandlers(mockSocket);

  const request: RoomCreateRequest = {
    userId: 'user-1',
    username: 'Test User',
    deviceId: 'device-1',
    deviceType: 'web',
  };

  // Simulate event
  mockSocket.on.mock.calls.find(call => call[0] === 'room:create')[1](request, callback);

  expect(callback).toHaveBeenCalledWith(
    expect.objectContaining({ success: true })
  );
  done();
});
```

## Testing Recommendations

**Priority Areas for Testing:**
1. `backend/src/services/room/RoomManager.ts` - Core business logic for room operations
2. `backend/src/services/sync/SyncEngine.ts` - Sync state management and conflict resolution
3. `shared/types/entities.ts` - All validator functions
4. `app/src/services/sync/SocketManager.ts` - Connection state management
5. `app/src/hooks/usePlayer.ts` - Audio playback state management

**Setup Recommendations:**
1. Install vitest: `pnpm add -D vitest`
2. Create `vitest.config.ts` at project root
3. Create test factories in `src/__tests__/factories/`
4. Add test scripts to `package.json`:
   ```json
   {
     "test": "vitest",
     "test:ui": "vitest --ui",
     "test:coverage": "vitest --coverage"
   }
   ```

---

*Testing analysis: 2026-02-14*
