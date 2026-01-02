# Quickstart Guide: MusicTogether 多设备实时同步音乐播放器

**Feature**: 001-realtime-sync-player  
**Date**: 2026-01-02  
**For**: Developers implementing this feature

## Prerequisites

### Development Environment

- **Bun**: Install from https://bun.sh (latest version)
- **Node.js**: 18+ (for Expo and React Native tooling)
- **Expo CLI**: `npm install -g expo-cli` or `bunx expo`
- **iOS** (optional): Xcode 15+ on macOS, iOS Simulator
- **Android** (optional): Android Studio, Android SDK 29+, Android Emulator
- **Git**: For version control

### IDE & Tools

- **VS Code** (recommended) with extensions:
  - ESLint
  - Prettier
  - TypeScript and JavaScript Language Features
  - React Native Tools
  - Expo Tools
- **Postman** or **Insomnia**: For testing REST API
- **Socket.io Client Tool**: For testing WebSocket events (or use browser console)

### Accounts & Services

- **NetEase Cloud Music API**: No account needed (using public API via npm package)
- **Expo Account** (optional): For cloud builds and OTA updates

---

## Repository Setup

### 1. Clone & Initialize

```bash
# Clone repository
git clone https://github.com/your-org/musictogether.git
cd musictogether

# Checkout feature branch
git checkout -b 001-realtime-sync-player

# Install dependencies
bun install
```

### 2. Project Structure

Verify the structure matches the plan:

```
musictogether/
├── app/                 # React Native mobile app
├── web/                 # Web version
├── backend/             # Bun + Socket.io server
├── shared/              # Shared types and constants
├── specs/               # Feature specifications (this document)
└── package.json         # Root workspace config
```

### 3. Environment Configuration

Create `.env` files for each environment:

**backend/.env**:
```env
NODE_ENV=development
PORT=3000
CORS_ORIGIN=*
SOCKET_IO_PING_INTERVAL=25000
SOCKET_IO_PING_TIMEOUT=60000

# NetEase Music API (using npm package, no API key needed)
NETEASE_CACHE_TTL_METADATA=86400  # 24 hours in seconds
NETEASE_CACHE_TTL_AUDIO=1200      # 20 minutes in seconds

# Redis (optional, for production caching)
# REDIS_URL=redis://localhost:6379
```

**app/.env** (React Native):
```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
EXPO_PUBLIC_WS_URL=ws://localhost:3000
```

**web/.env**:
```env
VITE_API_BASE_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

---

## Phase 0: Backend Setup (Bun + Socket.io)

### 1. Initialize Backend

```bash
cd backend
bun init -y

# Install dependencies
bun add socket.io neteasecloudmusicapienhanced express cors
bun add -d @types/express @types/cors typescript
```

### 2. Create Basic Server

**backend/src/server.ts**:
```typescript
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingInterval: 25000,
  pingTimeout: 60000,
  transports: ['websocket', 'polling']
});

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: Date.now() });
});

// Socket.io connection handler
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  
  socket.on('disconnect', (reason) => {
    console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
  });
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
```

### 3. Run Backend

```bash
bun run src/server.ts
```

Verify at http://localhost:3000/api/health

---

## Phase 1: Mobile App Setup (React Native + Expo)

### 1. Initialize Expo App

```bash
cd app
bunx create-expo-app@latest . --template blank-typescript

# Install dependencies
bun add socket.io-client react-native-track-player
bun add @react-navigation/native @react-navigation/native-stack
bun add expo-av expo-device expo-constants
bun add zustand immer  # State management
```

### 2. Configure React Native Track Player

**app/src/services/audio/player.ts**:
```typescript
import TrackPlayer, { Capability } from 'react-native-track-player';

export async function setupPlayer() {
  await TrackPlayer.setupPlayer();
  
  await TrackPlayer.updateOptions({
    capabilities: [
      Capability.Play,
      Capability.Pause,
      Capability.SkipToNext,
      Capability.SkipToPrevious,
      Capability.SeekTo,
    ],
    compactCapabilities: [
      Capability.Play,
      Capability.Pause,
    ],
  });
}
```

### 3. Create Basic Screens

**app/src/screens/HomeScreen.tsx**:
```typescript
import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';

export default function HomeScreen({ navigation }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>MusicTogether</Text>
      <Button title="创建房间" onPress={() => navigation.navigate('Player')} />
      <Button title="加入房间" onPress={() => {/* TODO */}} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#1a1a2e' },
  title: { fontSize: 32, fontWeight: 'bold', color: '#fff', marginBottom: 40 },
});
```

### 4. Run Mobile App

```bash
# iOS Simulator
bunx expo start --ios

# Android Emulator
bunx expo start --android

# Web (for quick testing)
bunx expo start --web
```

---

## Phase 2: Implement Core Features

### Priority Order (based on User Stories)

1. **P1: Single-device playback + EQ** (User Story 1)
   - Implement React Native Track Player integration
   - Web Audio API EQ for web version
   - Local storage for preferences
   - **Deliverable**: Users can play music and adjust EQ on one device

2. **P2: Multi-device room sync** (User Story 2)
   - Room creation/join Socket.io events
   - Time synchronization algorithm (NTP-like)
   - Drift detection and compensation (soft/hard sync)
   - **Deliverable**: Two devices can sync playback with < 50ms accuracy

3. **P3: Playlist collaboration** (User Story 3)
   - Playlist management events
   - Control mode switching (open ↔ host-only)
   - Permission enforcement
   - **Deliverable**: Multiple users can collaboratively manage playlist

4. **P4: HRTF spatial audio** (User Story 4)
   - Advanced audio processing (deferred to later)
   - Not required for MVP

### Implementation Flow (by Layer)

#### Backend Implementation Order

1. **Room Manager** (`backend/src/services/room/`)
   - Create room (generate 6-digit code)
   - Join room (validate code, add member)
   - Leave room (remove member, handle host transfer)
   - Room cleanup (expire after 24h)

2. **Sync Engine** (`backend/src/services/sync/`)
   - Time sync handler (NTP-like response)
   - Playback state broadcast (play, pause, seek)
   - Conflict resolution (Last-Write-Wins)

3. **Music API Proxy** (`backend/src/services/music/`)
   - Search endpoint with caching
   - Song detail endpoint
   - Audio URL endpoint with expiry handling

#### Frontend Implementation Order (Mobile & Web in parallel)

1. **Audio Service** (`app/src/services/audio/`)
   - React Native Track Player wrapper
   - Playback control (play, pause, seek)
   - Progress tracking
   - Playback rate adjustment for soft sync

2. **Sync Client** (`app/src/services/sync/`)
   - Socket.io connection manager
   - Time offset calculation
   - Drift detection loop
   - State reconciliation

3. **UI Screens** (`app/src/screens/`)
   - HomeScreen (create/join room)
   - PlayerScreen (now playing, controls, progress bar)
   - EQScreen (10-band equalizer with presets)
   - PlaylistScreen (shared playlist with drag-to-reorder)

4. **State Management** (`app/src/stores/`)
   - Room state (members, playlist, sync state)
   - Player state (current track, playback position)
   - Preferences (EQ settings, theme, history)

---

## Development Workflow

### Daily Development Loop

1. **Start backend**:
   ```bash
   cd backend
   bun run dev  # Uses nodemon or bun --watch
   ```

2. **Start mobile app**:
   ```bash
   cd app
   bunx expo start
   ```

3. **Test on multiple devices**:
   - iOS Simulator + Android Emulator (or two physical devices)
   - Use Chrome DevTools for web version
   - Monitor Socket.io events in backend logs

### Testing Multi-Device Sync

**Setup**:
1. Device A (iOS Simulator): Create room, note room code
2. Device B (Android Emulator): Join room with code
3. Device A: Play a track
4. Observe: Device B starts playing in sync

**Measure sync accuracy**:
```typescript
// Add to client code for debugging
setInterval(() => {
  const expectedPos = calculateExpectedPosition(syncState, localTimeOffset);
  const actualPos = await TrackPlayer.getPosition();
  const drift = expectedPos - actualPos;
  console.log(`Drift: ${drift.toFixed(1)}ms`);
}, 1000);
```

### Code Quality Checks

```bash
# Lint
bun run lint

# Type check
bun run tsc --noEmit

# Format
bun run prettier --write "src/**/*.{ts,tsx}"

# Test (when tests are added)
bun test
```

---

## Common Development Issues

### Issue 1: Socket.io connection fails on mobile

**Symptom**: `socket.on('connect')` never fires on React Native  
**Cause**: Network permissions or incorrect URL  
**Solution**:
1. Check `EXPO_PUBLIC_WS_URL` uses correct IP (not `localhost` on physical device)
2. Add to `app.json`:
   ```json
   {
     "expo": {
       "android": {
         "usesCleartextTraffic": true  // For development HTTP
       }
     }
   }
   ```

### Issue 2: Audio doesn't play in background (iOS)

**Symptom**: Music stops when app goes to background  
**Cause**: AVAudioSession not configured  
**Solution**: Add to `app.json`:
```json
{
  "expo": {
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["audio"]
      }
    }
  }
}
```

### Issue 3: Time sync offset unstable

**Symptom**: `localTimeOffset` fluctuates wildly  
**Cause**: Network jitter  
**Solution**: Use median of multiple samples (see research.md for algorithm)

### Issue 4: EQ not working on web

**Symptom**: EQ sliders don't affect audio  
**Cause**: AudioContext not initialized (browser autoplay policy)  
**Solution**: Initialize on user gesture:
```typescript
const audioContext = new AudioContext();
document.body.addEventListener('click', () => {
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
}, { once: true });
```

---

## Debugging Tools

### Socket.io Event Monitor

**Backend** (add to server.ts):
```typescript
io.on('connection', (socket) => {
  socket.onAny((eventName, ...args) => {
    console.log(`[${socket.id}] ${eventName}`, args);
  });
});
```

### React Native Debugger

1. Install: `brew install react-native-debugger` (macOS)
2. Run: `open "rndebugger://set-debugger-loc?host=localhost&port=8081"`
3. Enable Network Inspect for Socket.io messages

### Audio Sync Visualizer (optional)

Create a debug screen showing:
- Server timestamp
- Local timestamp
- Time offset
- Expected position vs actual position
- Current drift
- Sync corrections applied

---

## Performance Optimization Tips

1. **Reduce Socket.io message size**: Send `trackId` instead of full `Track` object when possible
2. **Debounce progress updates**: Send progress to server max every 500ms, not on every frame
3. **Lazy load album covers**: Use `react-native-fast-image` with caching
4. **Memoize EQ calculations**: Don't recreate filter nodes on every render
5. **Use React.memo** for list items in playlist (avoid unnecessary re-renders)

---

## Next Steps After Quickstart

1. ✅ Backend running with health check
2. ✅ Mobile app displays HomeScreen
3. 📝 Implement **P1 features** (single-device playback + EQ)
4. 📝 Implement **P2 features** (multi-device sync)
5. 📝 Implement **P3 features** (playlist collaboration)
6. 📝 Add unit tests for sync algorithms
7. 📝 Add E2E tests for critical flows
8. 📝 Performance optimization and load testing
9. 📝 UI polish (animations, loading states, error handling)
10. 📝 Documentation (API docs, architecture diagrams)

---

## Resources

- **Spec**: [spec.md](spec.md) - Full feature specification
- **Data Model**: [data-model.md](data-model.md) - Entity definitions
- **Contracts**: [contracts/](contracts/) - API and Socket.io schemas
- **Research**: [research.md](research.md) - Technical research findings
- **React Native Track Player**: https://react-native-track-player.js.org/
- **Socket.io**: https://socket.io/docs/v4/
- **Expo**: https://docs.expo.dev/
- **Web Audio API**: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API

---

**Version**: 1.0.0  
**Generated**: 2026-01-02  
**Need help?** Check [research.md](research.md) for detailed implementation patterns
