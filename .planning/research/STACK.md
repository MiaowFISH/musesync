# Technology Stack - Milestone Additions

**Project:** MuseSync
**Researched:** 2026-02-14
**Confidence:** MEDIUM (based on existing stack analysis + training data, web tools unavailable)

## Context

This document covers **incremental additions** to the existing stack for the next milestone. The base stack (React Native 0.81.5, Expo 54, Socket.io 4.6/4.8, React Native Track Player 4.1.2) is already in place and working.

## New Features Stack Requirements

### 1. Playback Drift Compensation

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Built-in** | N/A | Soft sync (time offset adjustment) | Use existing `TimeSyncService` + Track Player seek API - no new dependencies needed |
| **Built-in** | N/A | Hard sync (playback rate adjustment) | React Native Track Player 4.1.2 already supports `setRate()` for playback speed adjustment |

**Rationale:** Drift compensation is algorithmic, not library-dependent. The existing stack has everything needed:
- `TimeSyncService` already calculates server time offset
- Track Player's `getPosition()` provides current playback position
- Track Player's `seekTo()` handles soft sync (jump to position)
- Track Player's `setRate()` handles hard sync (0.98x - 1.02x playback speed)

**Implementation approach:**
```typescript
// Soft sync: Jump if drift > threshold (e.g., 500ms)
if (Math.abs(drift) > 500) {
  await TrackPlayer.seekTo(serverPosition);
}

// Hard sync: Adjust playback rate if drift is moderate (50-500ms)
if (Math.abs(drift) > 50 && Math.abs(drift) <= 500) {
  const rate = 1.0 + (drift * 0.0001); // Gentle correction
  await TrackPlayer.setRate(rate);
}
```

**Confidence:** HIGH - verified in existing codebase, Track Player API documented

---

### 2. Playlist Management with Room Sync

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Built-in** | N/A | Playlist state management | Extend existing Zustand store pattern (already used in `stores/index.tsx`) |
| **Socket.io** | 4.6.1 (backend) / 4.8.3 (app) | Playlist sync events | Already in use, add new event types to `shared/types/socket-events.ts` |

**New Socket Events Needed:**
```typescript
// Add to shared/types/socket-events.ts
'playlist:add'
'playlist:remove'
'playlist:reorder'
'playlist:clear'
'playlist:sync'
```

**Rationale:** Playlist is just another piece of room state. Use the same patterns as current track sync:
- Backend maintains authoritative playlist state in `RoomManager`
- Socket.io broadcasts playlist changes to all room members
- Frontend stores playlist in Zustand store
- Optimistic updates with server reconciliation

**Confidence:** HIGH - extends existing patterns

---

### 3. Host-Only Control Mode

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Built-in** | N/A | Permission system | Add `hostOnly: boolean` flag to room config, enforce in backend handlers |

**Rationale:** This is a permission/authorization feature, not a technology choice. Implementation:
- Add `controlMode: 'everyone' | 'host-only'` to room entity
- Backend validates user ID against room host before processing control events
- Frontend conditionally disables controls based on room mode + user role

**Confidence:** HIGH - simple authorization logic

---

### 4. Mobile Background Playback

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **react-native-track-player** | 4.1.2 (existing) | Background audio | Already configured for background playback on iOS/Android |
| **expo-notifications** | ~0.30.0 | Background task scheduling (optional) | Only if need periodic sync checks while backgrounded |
| **expo-background-fetch** | ~13.0.0 | Periodic background updates (optional) | Only if need to maintain socket connection in background |

**Rationale:** React Native Track Player already handles background audio playback. The main challenges are:
1. **iOS:** Track Player's audio session configuration already enables background audio
2. **Android:** Track Player creates a foreground service with notification
3. **Socket connection:** May need to handle reconnection when app returns to foreground

**Likely approach:** Don't maintain socket connection in background. Instead:
- Let Track Player handle audio playback (it already does)
- On app foreground, reconnect socket and sync state
- Use `AppState` API (built into React Native) to detect foreground/background transitions

**Optional dependencies only if:**
- Need periodic sync checks while backgrounded → `expo-background-fetch`
- Need to show custom notifications → `expo-notifications`

**Confidence:** MEDIUM - Track Player supports background audio, but socket reconnection strategy needs validation

---

### 5. Network Recovery with State Restoration

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **@react-native-community/netinfo** | ^11.4.1 | Network state monitoring | Industry standard for React Native network detection |
| **Socket.io** | 4.6.1 / 4.8.3 (existing) | Auto-reconnection | Built-in reconnection with exponential backoff |
| **Built-in** | N/A | State restoration | Use existing storage services + socket event replay |

**Installation:**
```bash
yarn workspace app add @react-native-community/netinfo
```

**Rationale:**
- Socket.io already handles reconnection automatically
- NetInfo detects network state changes (online/offline)
- On reconnect, client sends current state, server responds with authoritative state
- Use existing `RoomStateStorage` to persist state across app restarts

**Implementation pattern:**
```typescript
// Listen for reconnection
socket.on('connect', async () => {
  const localState = await RoomStateStorage.get();
  socket.emit('room:rejoin', { roomId, lastKnownState: localState });
});

// Server reconciles and responds
socket.on('room:state-sync', (authoritativeState) => {
  // Update local state to match server
});
```

**Confidence:** HIGH - standard pattern for real-time apps

---

### 6. Light Theme Support

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Built-in** | N/A | Theme system | Extend existing `useTheme` hook and `constants/theme.ts` |
| **@react-native-async-storage/async-storage** | 2.2.0 (existing) | Theme persistence | Already in use for preferences |

**Rationale:** Theme infrastructure already exists:
- `hooks/useTheme.ts` provides theme context
- `constants/theme.ts` defines dark theme colors
- `services/storage/PreferencesStorage.ts` handles user preferences

**Implementation:**
1. Add light theme color palette to `constants/theme.ts`
2. Add theme toggle to `PreferencesStorage`
3. Update `useTheme` to support both themes
4. Components already use theme values, so they'll automatically adapt

**Confidence:** HIGH - verified in existing codebase

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Network monitoring | @react-native-community/netinfo | expo-network-info | Deprecated, NetInfo is the official successor |
| Background tasks | expo-background-fetch | react-native-background-timer | Expo integration is cleaner, better iOS support |
| State management | Zustand (existing) | Redux Toolkit | Already using Zustand, no reason to add Redux complexity |
| Drift compensation | Custom algorithm | Third-party sync library | No mature React Native libraries for multi-client audio sync |

---

## Installation Commands

### Required
```bash
# Network monitoring for recovery
yarn workspace app add @react-native-community/netinfo@^11.4.1
```

### Optional (only if needed)
```bash
# Background fetch (if maintaining socket in background)
npx expo install expo-background-fetch

# Notifications (if custom notification UI needed)
npx expo install expo-notifications
```

---

## No New Dependencies Needed For

- **Drift compensation:** Use existing Track Player API
- **Playlist sync:** Use existing Socket.io + Zustand
- **Host-only mode:** Backend authorization logic
- **Theme switching:** Extend existing theme system
- **State restoration:** Use existing storage services

---

## Configuration Changes Required

### app.config.ts
```typescript
// For background audio (may already be configured)
export default {
  // ...
  ios: {
    infoPlist: {
      UIBackgroundModes: ['audio']
    }
  },
  android: {
    // Track Player handles foreground service automatically
  }
}
```

### Backend Socket.io
```typescript
// Enable reconnection state recovery
const io = new Server(server, {
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true,
  }
});
```

---

## TypeScript Type Additions

### shared/types/entities.ts
```typescript
interface Room {
  // ... existing fields
  controlMode: 'everyone' | 'host-only';
  playlist: PlaylistItem[];
}

interface PlaylistItem {
  id: string;
  songId: string;
  addedBy: string;
  addedAt: number;
}
```

### shared/types/socket-events.ts
```typescript
// Add playlist events
'playlist:add': (item: PlaylistItem) => void;
'playlist:remove': (itemId: string) => void;
'playlist:reorder': (order: string[]) => void;
'playlist:next': () => void;
```

---

## Confidence Assessment

| Feature | Confidence | Reason |
|---------|------------|--------|
| Drift compensation | HIGH | Verified Track Player API in codebase |
| Playlist sync | HIGH | Extends existing Socket.io patterns |
| Host-only mode | HIGH | Simple authorization logic |
| Background playback | MEDIUM | Track Player supports it, but socket strategy needs validation |
| Network recovery | HIGH | Standard Socket.io + NetInfo pattern |
| Theme switching | HIGH | Verified existing theme infrastructure |

---

## Research Limitations

**Web tools unavailable:** Could not verify latest versions via Context7 or official docs. Versions are based on:
- Existing package.json analysis (HIGH confidence)
- Training data for new dependencies (MEDIUM confidence)
- React Native Track Player API knowledge (HIGH confidence - verified in codebase)

**Recommended validation:**
- Check `@react-native-community/netinfo` latest version on npm
- Verify `expo-background-fetch` compatibility with Expo 54
- Test Track Player background audio on iOS (may need audio session configuration)

---

## Sources

- **Existing codebase:** `app/package.json`, `backend/package.json`, `app/src/services/`, `app/src/hooks/useTheme.ts`
- **React Native Track Player:** API methods verified in `app/src/services/audio/TrackPlayerService.ts`
- **Socket.io:** Reconnection patterns from existing `app/src/services/sync/SocketManager.ts`
- **Training data:** NetInfo, background fetch, general React Native patterns (MEDIUM confidence)
