# Coding Conventions

**Analysis Date:** 2026-02-14

## Naming Patterns

**Files:**
- PascalCase for components: `Button.tsx`, `RoomManager.ts`, `SyncEngine.ts`
- camelCase for utilities and services: `usePlayer.ts`, `roomHandlers.ts`, `SocketManager.ts`
- camelCase for hooks: `usePlayer.ts`, `useTheme.ts`
- UPPERCASE for constants: `ROOM_CONFIG`, `VALIDATION`, `ERROR_CODES`

**Functions:**
- camelCase for all functions: `createRoom()`, `joinRoom()`, `handleCreateRoom()`, `registerRoomHandlers()`
- Prefix event handlers with `handle`: `handleCreateRoom()`, `handleJoinRoom()`, `handleSearch()`
- Prefix Socket.io handlers with `register`: `registerRoomHandlers()`, `registerSyncHandlers()`

**Variables:**
- camelCase for all variables: `roomCode`, `username`, `isConnecting`, `createdRooms`
- Boolean variables prefixed with `is` or `has`: `isPlaying`, `isConnected`, `isLoading`, `hasError`
- Prefix state setters with `set`: `setRoomCode()`, `setUsername()`, `setIsConnecting()`

**Types:**
- PascalCase for interfaces and types: `Room`, `User`, `SyncState`, `Track`, `ButtonProps`, `UsePlayerResult`
- Suffix response types with `Response`: `RoomCreatedResponse`, `RoomJoinedResponse`
- Suffix request types with `Request`: `RoomCreateRequest`, `RoomJoinRequest`

## Code Style

**Formatting:**
- Tool: oxfmt (Rust-based formatter)
- Print width: 100 characters
- Tab width: 2 spaces
- End of line: LF
- Insert final newline: true
- Semicolons: required
- Quotes: double quotes (not single)
- Import sorting: ascending order (experimental)

**Linting:**
- Tool: oxlint (Rust-based linter)
- Plugins: eslint, import, node, oxc, promise, react, typescript, unicorn, vitest
- Config: `.oxlintrc.json` at project root
- Run: `pnpm run lint` or `yarn lint`
- Fix: `pnpm run lint:fix` or `yarn lint:fix`

## Import Organization

**Order:**
1. External packages (React, React Native, third-party libraries)
2. Type imports from external packages
3. Internal services and utilities
4. Internal types from shared
5. Internal components and hooks
6. Relative imports

**Example from `backend/src/server.ts`:**
```typescript
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';

import musicRoutes from './routes/music';
import { registerRoomHandlers } from './handlers/roomHandlers';
import { syncEngine } from './services/sync/SyncEngine';

import type { SocketEvents } from '@shared/types/socket-events';
```

**Path Aliases:**
- `@shared/*` - Points to shared workspace: `../shared/*` (backend), `../shared/*` (app)
- `@/*` - Points to app src directory (app only): `./src/*`

## Error Handling

**Patterns:**
- Try-catch blocks wrap all async operations and event handlers
- Errors logged with context prefix: `[ComponentName]` or `[ServiceName]`
- Return objects with `success` boolean and optional `error` object
- Error objects contain `code` (string) and `message` (string)

**Example from `backend/src/services/room/RoomManager.ts`:**
```typescript
try {
  // Validate username
  if (!VALIDATION.USERNAME_MIN_LENGTH || request.username.length > VALIDATION.USERNAME_MAX_LENGTH) {
    return {
      success: false,
      error: {
        code: ERROR_CODES.INVALID_REQUEST,
        message: `Username must be 1-20 characters`,
      },
    };
  }
  // ... operation
  return { success: true, room };
} catch (error) {
  console.error('[RoomManager] Error creating room:', error);
  return {
    success: false,
    error: {
      code: ERROR_CODES.CREATION_FAILED,
      message: 'Failed to create room',
    },
  };
}
```

## Logging

**Framework:** console (no external logging library)

**Patterns:**
- All logs prefixed with context in brackets: `[ServiceName]`, `[ComponentName]`, `[HandlerName]`
- Log levels: `console.log()` for info, `console.warn()` for warnings, `console.error()` for errors
- Include relevant data in log messages for debugging

**Examples:**
```typescript
console.log(`[RoomManager] Room created: ${roomId} by ${request.username}`);
console.warn(`[SyncEngine] Rejected stale update from ${userId}: version ${newSyncState.version} < ${currentState.version}`);
console.error('[SocketManager] Connection error:', error.message);
```

## Comments

**When to Comment:**
- JSDoc comments for public functions and exported classes
- Inline comments for complex logic or non-obvious decisions
- Section dividers for major code blocks (using `// ============================================================================`)

**JSDoc/TSDoc:**
- Used for public APIs and exported functions
- Include parameter descriptions and return type
- Example from `backend/src/services/room/RoomManager.ts`:
```typescript
/**
 * Create a new room
 */
createRoom(request: RoomCreateRequest): RoomCreatedResponse {
  // ...
}

/**
 * Join an existing room
 */
joinRoom(request: RoomJoinRequest): RoomJoinedResponse {
  // ...
}
```

## Function Design

**Size:** Functions typically 20-50 lines, rarely exceeding 100 lines

**Parameters:**
- Use object parameters for functions with multiple arguments
- Example: `createRoom(request: RoomCreateRequest)` instead of `createRoom(userId, username, deviceId, deviceType)`

**Return Values:**
- Return objects with `success` boolean for operations that can fail
- Return `void` for event handlers that don't need responses
- Return typed objects for data retrieval: `Room | undefined`, `User[]`

## Module Design

**Exports:**
- Named exports for classes and functions
- Singleton instances exported at module level
- Example from `backend/src/services/room/RoomManager.ts`:
```typescript
export class RoomManager {
  // ...
}

export const roomManager = new RoomManager();
```

**Barrel Files:**
- Not used; imports are direct from source files
- Example: `import { roomManager } from './services/room/RoomManager'` (not from index.ts)

## TypeScript Configuration

**Compiler Options:**
- Target: ES2022
- Module: ESNext
- Strict mode: enabled
- Module resolution: bundler
- No emit: true (for type checking only)
- Isolated modules: true

**Type Safety:**
- All functions have explicit return types
- All parameters have explicit types
- No `any` types except in Socket.io event handlers where necessary
- Type guards used for runtime validation: `isValidRoomId()`, `isValidQuality()`, `isValidPlaybackStatus()`

## React/React Native Patterns

**Functional Components:**
- All components are functional with hooks
- Component signature: `export const ComponentName: React.FC<Props> = (props) => { ... }`

**Hooks:**
- Custom hooks follow naming convention: `useHookName()`
- Hooks return typed objects with state and methods
- Example from `app/src/hooks/usePlayer.ts`:
```typescript
export interface UsePlayerResult {
  isPlaying: boolean;
  currentTrack: Track | null;
  play: (track: Track, audioUrl: string) => Promise<void>;
  // ...
}

export function usePlayer(): UsePlayerResult {
  // ...
}
```

**Props:**
- Props defined as interfaces with optional fields marked with `?`
- Example from `app/src/components/ui/Button.tsx`:
```typescript
interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
}
```

---

*Convention analysis: 2026-02-14*
