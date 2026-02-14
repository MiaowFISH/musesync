# Phase 3: Background Playback & Network Recovery - Research

**Researched:** 2026-02-14
**Domain:** React Native background audio, network resilience, real-time sync
**Confidence:** MEDIUM-HIGH

## Summary

Phase 3 requires implementing background audio playback with lock screen controls and network recovery with automatic reconnection. The standard approach for Expo projects uses `expo-audio` for basic audio management combined with `react-native-track-player` for lock screen controls, though the latter requires a custom development client. Network detection uses `@react-native-community/netinfo`, while Socket.io provides built-in exponential backoff for reconnection.

The project already has Socket.io with basic reconnection configured. The main additions are: (1) configuring audio mode for background playback, (2) integrating react-native-track-player for lock screen controls, (3) implementing AppState listeners for foreground/background transitions, (4) adding NetInfo for network status detection, and (5) implementing stale state rejection logic.

**Primary recommendation:** Use react-native-track-player for lock screen controls (requires custom dev client), expo-audio for audio mode configuration, AppState for lifecycle detection, NetInfo for network status, and enhance existing Socket.io reconnection with UI feedback.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**后台播放体验 (Background Playback Experience)**
- 锁屏控件：播放/暂停 + 上一首/下一首 + 进度条拖动（类似 Spotify）
- 锁屏/通知栏信息：歌曲名 + 歌手名 + 封面图
- 队列播完行为：遵循当前循环模式（列表循环从头开始，单曲循环重复，无循环则停止）
- 后台同步策略：后台时独立播放，不响应房间同步事件（别人切歌/暂停不影响后台播放）

**前后台切换同步 (Foreground/Background Transition Sync)**
- 回前台时自动拉取房间最新状态并同步，同时用 Toast 通知用户发生了什么变化（如「房间已切到第3首」）
- Toast 仅作通知，同步是自动的，用户无需手动操作
- UI 更新采用平滑过渡动画（封面渐变、进度条动画滑动），不是硬切

**网络断开与恢复 (Network Disconnection & Recovery)**
- 断线提示：播放界面顶部显示横幅（红色/黄色），如「网络已断开，正在重连...」
- 离线播放行为：断网后继续播放当前已缓冲的音频，播完当前歌后停止（不切歌）
- 重连策略：自动重连 + 指数退避（1s, 2s, 4s...），多次失败后显示「重新连接」按钮让用户手动触发
- 重连后同步：与前后台切换保持一致 — 自动同步房间最新状态 + Toast 通知变化

### Claude's Discretion
- 指数退避的具体参数（最大重试次数、最大间隔）
- 横幅的具体颜色和动画
- 平滑过渡动画的具体实现方式
- 锁屏控件的平台适配细节
- 过期状态（>60s）的具体拒绝逻辑

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-native-track-player | ^4.1.x | Lock screen controls, background audio service | Industry standard for music apps, handles iOS/Android media controls, notification integration |
| @react-native-community/netinfo | ^11.5.x | Network connectivity detection | Official community package, reliable online/offline detection with `isConnected` and `isInternetReachable` |
| expo-audio | ^1.1.x | Audio mode configuration | Expo SDK 54's official audio library (replaces expo-av), configures background playback behavior |
| React Native AppState | Built-in | Foreground/background detection | Core React Native API, tracks app lifecycle states (active/background/inactive) |
| socket.io-client | ^4.8.3 (existing) | WebSocket with auto-reconnection | Already in project, has built-in exponential backoff |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| react-native-reanimated | ^4.2.1 (existing) | Smooth UI transitions | For cover fade, progress bar animations when syncing state |
| @react-native-async-storage/async-storage | ^2.2.0 (existing) | Persist last known state | Store room state for offline display |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-native-track-player | expo-audio alone | expo-audio lacks lock screen controls; would need custom native modules |
| @react-native-community/netinfo | Manual fetch polling | NetInfo provides real-time events; polling wastes battery and is less reliable |
| Socket.io built-in reconnection | Custom reconnection logic | Socket.io's exponential backoff is battle-tested; custom logic is error-prone |

**Installation:**
```bash
# Network detection
npx expo install @react-native-community/netinfo

# Lock screen controls (requires custom dev client)
yarn add react-native-track-player

# expo-audio already installed (v1.1.1)
# socket.io-client already installed (v4.8.3)
```

**Custom Development Client Required:**
react-native-track-player requires native modules not in Expo Go. Must build custom dev client:
```bash
npx expo install expo-dev-client
eas build --profile development --platform ios
eas build --profile development --platform android
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── services/
│   ├── audio/
│   │   ├── AudioService.ts           # Existing
│   │   ├── BackgroundAudioService.ts # NEW: Track player integration
│   │   └── PlaybackService.ts        # NEW: Track player service file
│   ├── sync/
│   │   ├── SocketManager.ts          # Existing - enhance reconnection UI
│   │   └── NetworkMonitor.ts         # NEW: NetInfo wrapper
│   └── lifecycle/
│       └── AppLifecycleManager.ts    # NEW: AppState + sync coordination
├── hooks/
│   ├── useNetworkStatus.ts           # NEW: Network state hook
│   └── useAppLifecycle.ts            # NEW: Foreground/background hook
└── components/
    └── common/
        └── NetworkBanner.tsx          # NEW: Disconnection banner
```

### Pattern 1: Background Audio Service Setup

**What:** Initialize react-native-track-player with playback service for lock screen controls

**When to use:** App startup, before any audio playback

**Example:**
```typescript
// src/services/audio/PlaybackService.ts
import TrackPlayer, { Event } from 'react-native-track-player';

export const PlaybackService = async function() {
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());
  TrackPlayer.addEventListener(Event.RemoteSeek, (position) => TrackPlayer.seekTo(position));
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.destroy());
};

// index.ts (register service)
import TrackPlayer from 'react-native-track-player';
import { PlaybackService } from './src/services/audio/PlaybackService';

AppRegistry.registerComponent(appName, () => App);
TrackPlayer.registerPlaybackService(() => PlaybackService);
```

### Pattern 2: Audio Mode Configuration

**What:** Configure expo-audio for background playback on iOS and Android

**When to use:** App initialization, before loading any audio

**Example:**
```typescript
// src/services/audio/BackgroundAudioService.ts
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-audio';

export async function configureAudioMode() {
  await Audio.setAudioModeAsync({
    staysActiveInBackground: true,
    playsInSilentModeIOS: true,
    interruptionModeIOS: InterruptionModeIOS.DuckOthers,
    interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
}
```

**iOS Configuration (app.json):**
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

### Pattern 3: AppState Lifecycle Management

**What:** Detect foreground/background transitions and coordinate sync behavior

**When to use:** Throughout app lifecycle to manage background independence and foreground sync

**Example:**
```typescript
// src/hooks/useAppLifecycle.ts
import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';

export function useAppLifecycle(
  onForeground: () => void,
  onBackground: () => void
) {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        onForeground();
      } else if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        onBackground();
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [onForeground, onBackground]);
}
```

### Pattern 4: Network Status Detection

**What:** Monitor network connectivity with NetInfo and display status

**When to use:** Throughout app lifecycle to detect disconnections and trigger reconnection

**Example:**
```typescript
// src/hooks/useNetworkStatus.ts
import { useNetInfo } from '@react-native-community/netinfo';

export function useNetworkStatus() {
  const netInfo = useNetInfo();

  return {
    isConnected: netInfo.isConnected ?? false,
    isInternetReachable: netInfo.isInternetReachable ?? false,
    type: netInfo.type,
  };
}

// Usage in component
const { isConnected, isInternetReachable } = useNetworkStatus();

useEffect(() => {
  if (!isConnected) {
    // Show disconnection banner
  } else if (isConnected && !isInternetReachable) {
    // Show "no internet" banner
  }
}, [isConnected, isInternetReachable]);
```

### Pattern 5: Stale State Rejection

**What:** Reject sync updates older than 60 seconds using timestamp validation

**When to use:** When receiving room state updates from server after reconnection or foreground transition

**Example:**
```typescript
// src/services/sync/StateValidator.ts
const STALE_THRESHOLD_MS = 60 * 1000; // 60 seconds

export function isStateStale(serverTimestamp: number, clientTimestamp: number): boolean {
  const age = clientTimestamp - serverTimestamp;
  return age > STALE_THRESHOLD_MS;
}

export function validateAndApplyState(
  serverState: RoomState,
  currentClientTime: number
): { valid: boolean; reason?: string } {
  if (isStateStale(serverState.timestamp, currentClientTime)) {
    return {
      valid: false,
      reason: `State is ${Math.round((currentClientTime - serverState.timestamp) / 1000)}s old (threshold: 60s)`
    };
  }
  return { valid: true };
}
```

### Pattern 6: Foreground Sync with Smooth Transitions

**What:** Fetch latest room state when returning to foreground, apply with animations

**When to use:** AppState transitions from background to active

**Example:**
```typescript
// src/services/lifecycle/AppLifecycleManager.ts
import { withTiming } from 'react-native-reanimated';

export class AppLifecycleManager {
  async onForeground() {
    // Fetch authoritative state from server
    const latestState = await roomService.fetchCurrentState();

    // Validate not stale
    const validation = validateAndApplyState(latestState, Date.now());
    if (!validation.valid) {
      console.warn('Stale state rejected:', validation.reason);
      return;
    }

    // Detect changes
    const changes = this.detectChanges(currentState, latestState);

    // Apply with animations
    if (changes.trackChanged) {
      // Animate cover fade
      coverOpacity.value = withTiming(0, { duration: 200 }, () => {
        updateTrack(latestState.currentTrack);
        coverOpacity.value = withTiming(1, { duration: 200 });
      });
    }

    if (changes.positionChanged) {
      // Animate progress bar
      progressPosition.value = withTiming(latestState.position, { duration: 300 });
    }

    // Show toast notification
    if (changes.trackChanged) {
      showToast(`房间已切到第${latestState.queueIndex + 1}首`);
    }
  }
}
```

### Anti-Patterns to Avoid

- **Responding to sync events while backgrounded:** User decision is to play independently in background, only sync on foreground return
- **Hard-cutting UI on state sync:** Use smooth transitions (fade, animated slide) instead of instant updates
- **Blocking UI thread during reconnection:** Socket.io reconnection is async, show banner but don't freeze UI
- **Trusting client timestamps for stale detection:** Always use server timestamp as source of truth, compare against synced client time
- **Continuing to next track when offline:** User decision is to stop after current track finishes when disconnected

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Lock screen media controls | Custom native modules for iOS/Android | react-native-track-player | Handles platform differences, notification integration, remote control events, Bluetooth/CarPlay |
| Network connectivity detection | Polling fetch() or manual listeners | @react-native-community/netinfo | Real-time events, handles edge cases (connected but no internet), battery efficient |
| Exponential backoff reconnection | Custom retry logic with setTimeout | Socket.io built-in reconnection | Battle-tested, includes jitter to prevent thundering herd, configurable delays |
| Background audio session management | Direct AVAudioSession/AudioManager calls | expo-audio setAudioModeAsync | Cross-platform API, handles interruptions (calls, alarms), manages audio focus |
| Smooth UI transitions | Manual Animated API orchestration | react-native-reanimated withTiming | Runs on UI thread (60fps), simpler API, better performance |

**Key insight:** Background audio and network resilience have many platform-specific edge cases (iOS audio interruptions, Android battery optimization, network type detection). Using established libraries prevents months of debugging platform quirks.

## Common Pitfalls

### Pitfall 1: Background Audio Not Working in Expo Go

**What goes wrong:** Audio stops when app backgrounds, even with `staysActiveInBackground: true`

**Why it happens:** Expo Go doesn't include background audio entitlements; react-native-track-player requires native modules

**How to avoid:** Build custom development client with `expo-dev-client` and `eas build --profile development`

**Warning signs:** Testing only in Expo Go, audio works in foreground but stops immediately on background

### Pitfall 2: Socket.io Reconnection Without Room Rejoin

**What goes wrong:** Socket reconnects but client isn't in room anymore, stops receiving sync events

**Why it happens:** Server-side room membership is tied to socket connection, which is lost on disconnect

**How to avoid:** Implement `room:rejoin` event handler on Socket.io `reconnect` event (already partially implemented in SocketManager.ts)

**Warning signs:** Connection state shows "connected" but no sync events received after reconnection

### Pitfall 3: Race Condition Between AppState and Network Events

**What goes wrong:** App returns to foreground while network is still reconnecting, triggers duplicate sync attempts

**Why it happens:** AppState "active" and Socket.io "reconnect" events fire independently and nearly simultaneously

**How to avoid:** Use a sync lock/flag to prevent concurrent sync operations, or debounce sync triggers

**Warning signs:** Multiple "fetching room state" logs, duplicate Toast notifications, flickering UI

### Pitfall 4: iOS Background Audio Stops After 3 Minutes

**What goes wrong:** Audio plays in background initially but stops after ~3 minutes

**Why it happens:** Missing `UIBackgroundModes: ["audio"]` in app.json, or audio session not properly configured

**How to avoid:** Add background mode to app.json AND call `setAudioModeAsync` before playing audio

**Warning signs:** Works in foreground, works briefly in background, then silent (no error logs)

### Pitfall 5: Stale State Accepted Due to Clock Skew

**What goes wrong:** Client accepts 70-second-old state because client clock is behind server clock

**Why it happens:** Comparing server timestamp against unsynchronized client timestamp

**How to avoid:** Use TimeSyncService (already in project) to calculate offset, adjust client time before comparison

**Warning signs:** Old tracks playing after reconnection, queue position jumping backwards

### Pitfall 6: Lock Screen Controls Out of Sync with App State

**What goes wrong:** User pauses from lock screen but app UI still shows playing, or vice versa

**Why it happens:** Not listening to TrackPlayer events (RemotePlay, RemotePause) and updating app state

**How to avoid:** In PlaybackService, emit events to app state store when remote controls are used

**Warning signs:** Lock screen shows playing but no audio, or audio playing but lock screen shows paused

### Pitfall 7: Network Banner Doesn't Dismiss After Reconnection

**What goes wrong:** "Reconnecting..." banner stays visible even after successful reconnection

**Why it happens:** Not listening to Socket.io `connect` event to update UI state, or race condition with AppState

**How to avoid:** Subscribe to SocketManager connection state changes, update banner visibility reactively

**Warning signs:** Banner persists indefinitely, requires app restart to clear

## Code Examples

Verified patterns from official sources and existing codebase:

### Initializing Track Player
```typescript
// App.tsx or index.ts
import TrackPlayer from 'react-native-track-player';

useEffect(() => {
  const setupPlayer = async () => {
    try {
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
          Capability.SkipToNext,
        ],
      });
    } catch (error) {
      console.error('Failed to setup player:', error);
    }
  };

  setupPlayer();
}, []);
```

### Updating Lock Screen Metadata
```typescript
// When track changes
await TrackPlayer.updateNowPlayingMetadata({
  title: track.title,
  artist: track.artist,
  artwork: track.coverUrl,
  duration: track.duration,
});
```

### Network Status Banner Component
```typescript
// src/components/common/NetworkBanner.tsx
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { socketManager } from '@/services/sync/SocketManager';

export function NetworkBanner() {
  const { isConnected } = useNetworkStatus();
  const [connectionState, setConnectionState] = useState(socketManager.getConnectionState());

  useEffect(() => {
    return socketManager.onStateChange(setConnectionState);
  }, []);

  const showBanner = !isConnected || connectionState === 'reconnecting' || connectionState === 'error';
  const bannerText = !isConnected
    ? '网络已断开，正在重连...'
    : connectionState === 'error'
    ? '连接失败'
    : '正在重连...';

  if (!showBanner) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>{bannerText}</Text>
      {connectionState === 'error' && (
        <Button onPress={() => socketManager.connect()}>重新连接</Button>
      )}
    </View>
  );
}
```

### Coordinating Background Independence and Foreground Sync
```typescript
// src/services/lifecycle/AppLifecycleManager.ts
export class AppLifecycleManager {
  private isInBackground = false;

  constructor(
    private socketManager: SocketManager,
    private roomService: RoomService
  ) {
    this.setupAppStateListener();
  }

  private setupAppStateListener() {
    AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && this.isInBackground) {
        this.handleForeground();
      } else if (nextAppState.match(/inactive|background/)) {
        this.handleBackground();
      }
    });
  }

  private handleBackground() {
    this.isInBackground = true;
    // Disable room sync event handlers
    this.roomService.pauseSyncEvents();
    console.log('[Lifecycle] Entered background - sync paused');
  }

  private async handleForeground() {
    this.isInBackground = false;
    console.log('[Lifecycle] Returned to foreground - syncing state');

    // Re-enable sync events
    this.roomService.resumeSyncEvents();

    // Fetch latest state
    try {
      const latestState = await this.roomService.fetchCurrentState();
      await this.roomService.syncToState(latestState, { animated: true, showToast: true });
    } catch (error) {
      console.error('[Lifecycle] Failed to sync on foreground:', error);
    }
  }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| expo-av | expo-audio | SDK 54 (late 2025) | expo-av deprecated, expo-audio is dedicated audio library with cleaner API |
| Manual AppState tracking | AppState with granular states | React Native 0.76+ (2026) | New `background_active` and `background_passive` sub-states for finer control |
| Polling for network status | NetInfo event-driven | NetInfo 11.x (2025) | Real-time connectivity changes, better battery efficiency |
| Custom lock screen controls | react-native-track-player | Stable since 2020, v4.x (2024) | Cross-platform standard, handles all media control edge cases |
| Socket.io v3 | Socket.io v4 | 2021 | Better TypeScript support, improved reconnection logic |

**Deprecated/outdated:**
- expo-av: Removed in SDK 55 (January 2026), use expo-audio instead
- React Native NetInfo (core): Moved to community package @react-native-community/netinfo in 2019
- Manual background audio native modules: Use react-native-track-player instead of custom Swift/Kotlin code

## Open Questions

1. **Custom Development Client Build Time**
   - What we know: react-native-track-player requires custom dev client, not Expo Go
   - What's unclear: Build time impact on development workflow, whether to build locally or use EAS
   - Recommendation: Use EAS Build for consistency, document build process in phase plan

2. **Expo SDK 55 Migration Timeline**
   - What we know: SDK 55 beta released January 2026, includes expo-audio improvements
   - What's unclear: Whether to upgrade mid-phase or wait until after Phase 3
   - Recommendation: Stay on SDK 54 for Phase 3 stability, plan SDK 55 upgrade as separate task

3. **Server-Side Heartbeat Implementation**
   - What we know: NETR-05 requires server-side heartbeat timeout enforcement
   - What's unclear: Whether server already implements this, or needs to be added
   - Recommendation: Verify server implementation, add if missing (may be server-side task)

4. **Offline Audio Buffering Duration**
   - What we know: User decision is to continue playing current track when offline
   - What's unclear: How much audio is buffered by expo-audio/TrackPlayer, whether it's sufficient
   - Recommendation: Test with real network disconnection, may need to implement buffer monitoring

## Sources

### Primary (HIGH confidence)
- React Native AppState API: [reactnative.dev](https://reactnative.dev/docs/appstate)
- Expo Audio SDK 54 Documentation: [docs.expo.dev](https://docs.expo.dev/versions/v54.0.0/sdk/audio/)
- react-native-track-player Documentation: [rntp.dev](https://rntp.dev/docs/basics/getting-started)
- @react-native-community/netinfo GitHub: [github.com/react-native-netinfo](https://github.com/react-native-netinfo/react-native-netinfo)
- Socket.io Client Documentation: [socket.io](https://socket.io/docs/v4/client-api/)

### Secondary (MEDIUM confidence)
- [React Native AppState 2026 Enhancements](https://medium.com) - Granular background states, security handlers
- [Expo SDK 54 Background Audio Guide](https://dev.to) - Configuration steps for iOS and Android
- [react-native-track-player Expo Integration](https://medium.com) - Custom development client setup
- [NetInfo Usage Guide](https://dev.to) - useNetInfo hook and connectivity detection
- [Socket.io Reconnection Best Practices](https://socket.io) - Exponential backoff configuration

### Tertiary (LOW confidence)
- Community reports of expo-audio stopping after 3 minutes on Android (Reddit, GitHub issues) - needs verification with SDK 54

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Libraries are well-established and documented
- Architecture: MEDIUM-HIGH - Patterns are proven but integration with existing codebase needs validation
- Pitfalls: MEDIUM - Based on community reports and documentation, some need real-world testing

**Research date:** 2026-02-14
**Valid until:** 2026-03-14 (30 days - stable ecosystem)

**Notes:**
- Project already has Socket.io with basic reconnection (SocketManager.ts)
- Project already has TimeSyncService for clock synchronization
- Project uses Expo SDK 54 with expo-audio 1.1.1
- Custom development client will be new requirement for team
