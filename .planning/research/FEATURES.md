# Feature Landscape

**Domain:** Real-time sync music player
**Researched:** 2026-02-14
**Confidence:** MEDIUM (based on training data, unable to verify with current sources)

## Already Built Features

For context, these are implemented:
- Room creation/joining (6-digit codes)
- Basic playback sync (play/pause/seek)
- EQ equalizer with presets
- Music search (NetEase Cloud Music API)
- Connection status indicator
- Auto-reconnect
- Playback history
- Settings page

## Table Stakes

Features users expect in real-time sync music players. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Drift compensation** | Core sync requirement - without it, users hear different parts of song after 30-60 seconds | High | Target <50ms. Requires periodic time sync checks, playback position adjustment, buffer management |
| **Background playback** | Mobile users expect music to continue when app is backgrounded or screen locks | Medium | Platform-specific (iOS/Android have different requirements). Requires foreground service notification on Android, background audio capability on iOS |
| **Network recovery** | Connection drops are common on mobile - app must gracefully handle and resync | Medium | Must preserve room state, queue position, and resync playback position on reconnect. Already have auto-reconnect, need to add state recovery |
| **Basic playlist/queue** | Users expect to see what's playing next and add songs to queue | Low-Medium | Minimum: current song, next songs, ability to add. Without this, users can't plan listening session |
| **Host controls** | Someone needs to manage the room (kick users, control playback) | Low | Expected in any multi-user session. Host = room creator by default |

## Differentiators

Features that set product apart. Not expected, but create competitive advantage.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Host-only control mode** | Prevents chaos in large rooms - only host can control playback | Low | Toggle between "everyone controls" vs "host only". Useful for DJ scenarios, listening parties |
| **Collaborative playlist editing** | All users can reorder queue, remove songs, vote on next track | Medium | Goes beyond basic queue. Enables democratic listening. Requires conflict resolution for simultaneous edits |
| **Playlist templates/presets** | Pre-built playlists for moods/genres that users can instantly start | Low | Reduces friction for new rooms. "Study session", "Party mix", "Chill vibes" etc. |
| **Listening statistics** | Show room stats: total listening time, most played songs, active users | Low-Medium | Gamification element. Makes sessions feel more meaningful |
| **Reaction system** | Users can react to songs in real-time (emoji, upvote/downvote) | Low | Social engagement without chat. Lightweight interaction |
| **Theme switching (light/dark)** | Personalization, accessibility | Low | Table stakes for modern apps, but differentiator if done well with multiple themes |
| **Cross-fade between songs** | Smooth transitions, professional DJ feel | Medium | Requires audio mixing, buffer management. Premium feel |
| **Lyrics sync** | Real-time lyrics display synced to playback | Medium | Depends on lyrics API availability. High engagement feature |
| **Room persistence** | Rooms stay alive between sessions, users can rejoin same room | Medium | Requires backend state management, room expiration logic. Enables recurring listening groups |

## Anti-Features

Features to explicitly NOT build (at least not now).

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **User accounts/authentication** | Adds friction, contradicts "anonymous" design principle | Stick with anonymous 6-digit room codes. Simple is better |
| **In-app chat** | Scope creep, moderation burden, users already have messaging apps | Let users coordinate via their preferred chat app. Focus on music sync |
| **Music upload/hosting** | Legal liability, storage costs, copyright issues | Continue using NetEase Cloud Music API. Don't become a music host |
| **Video sync** | Massive complexity increase, different use case | Stay focused on music. Video sync is a different product |
| **Advanced DJ features** (loops, samples, mixing) | Niche use case, high complexity | Keep it simple. This is for listening together, not production |
| **Social network features** (profiles, friends, discovery) | Scope creep, maintenance burden | Anonymous sessions only. Users share room codes directly |
| **Monetization/ads** (for now) | Premature, hurts UX before product-market fit | Focus on core experience first |

## Feature Dependencies

```
Background playback → Network recovery (must handle reconnect while backgrounded)
Network recovery → Drift compensation (resync requires drift correction)
Host-only mode → Host controls (mode is subset of control system)
Collaborative playlist → Basic playlist (must have queue first)
Room persistence → Network recovery (rejoining requires state restoration)
Cross-fade → Background playback (audio mixing must work in background)
```

## MVP Recommendation for Next Milestone

Based on your active requirements, prioritize in this order:

### Must Have (Table Stakes)
1. **Drift compensation** - Core sync quality. Without this, the "sync" promise breaks down
2. **Background playback** - Mobile music app requirement. Users will abandon if music stops when they switch apps
3. **Network recovery** - Already have auto-reconnect, need to add state recovery for complete experience

### Should Have (High Value, Lower Risk)
4. **Host-only control mode** - Simple toggle, prevents chaos, enables new use cases
5. **Theme switching (light theme)** - Quick win, accessibility, user request

### Nice to Have (Defer to Later)
6. **Collaborative playlist editing** - Build basic queue first, then add collaboration
7. **Reaction system** - Social feature, not critical for core sync experience
8. **Lyrics sync** - Depends on API availability, nice-to-have

### Defer Entirely
- Playlist templates (can add after collaborative editing works)
- Listening statistics (analytics feature, not core)
- Cross-fade (polish feature, complex)
- Room persistence (requires backend changes, can add later)

## Feature Complexity Breakdown

### Drift Compensation (High Complexity)
**Why complex:**
- Requires accurate time synchronization between clients and server
- Must account for network latency variations
- Needs smooth playback adjustments (can't just jump, causes audio glitches)
- Platform-specific audio APIs (React Native audio libraries have limitations)

**Key challenges:**
- Measuring drift without disrupting playback
- Adjusting playback rate subtly (1.01x or 0.99x speed) vs hard seeks
- Handling edge cases (buffering, seeking, song changes)

### Background Playback (Medium Complexity)
**Why complex:**
- iOS requires specific audio session configuration
- Android requires foreground service with notification
- Must maintain WebSocket connection while backgrounded
- Platform-specific battery optimization can kill background tasks

**Key challenges:**
- Expo limitations (may need custom native modules)
- Notification controls (play/pause/skip from lock screen)
- Keeping sync active while backgrounded

### Network Recovery (Medium Complexity)
**Why complex:**
- Must preserve: room state, queue position, playback position, user list
- Race conditions (what if room state changed while disconnected?)
- Conflict resolution (user was at 1:30, room is now at 2:00 - which wins?)

**Key challenges:**
- Determining "ground truth" after reconnect
- Smooth resync without jarring user
- Handling edge cases (room closed, kicked while disconnected)

### Host-Only Mode (Low Complexity)
**Why simple:**
- Boolean flag on room state
- Server-side permission checks on control events
- UI changes to disable controls for non-hosts

**Key challenges:**
- Communicating mode to users clearly
- Handling host disconnect (transfer host? freeze room?)

### Theme Switching (Low Complexity)
**Why simple:**
- React Native styling with theme context
- Persist preference to AsyncStorage
- Update colors/styles based on theme

**Key challenges:**
- Ensuring all components respect theme
- Smooth transition animation

## Feature Interaction Patterns

### Drift Compensation + Background Playback
When app is backgrounded, drift compensation must still run. This means:
- WebSocket must stay connected
- Periodic sync checks continue
- Playback adjustments happen even when UI is not visible

### Network Recovery + Drift Compensation
After reconnect, drift compensation must:
1. Get current server time and playback position
2. Calculate local drift
3. Perform immediate correction (may be large)
4. Resume periodic drift checks

### Host-Only Mode + Network Recovery
If host disconnects in host-only mode:
- Option A: Freeze playback until host returns (preserves mode)
- Option B: Transfer host to next user (maintains functionality)
- Option C: Auto-switch to collaborative mode (pragmatic)

Recommend: Option B with notification "Host disconnected, [User] is now host"

## Platform-Specific Considerations

### iOS
- Background audio requires `audio` background mode in Info.plist
- Must configure AVAudioSession properly
- App Store review requires clear explanation of background audio usage
- iOS may throttle background WebSocket connections

### Android
- Foreground service required for background playback (shows persistent notification)
- Must request `FOREGROUND_SERVICE` permission
- Battery optimization can kill background tasks (need to request exemption)
- Different behavior across Android versions (Doze mode, App Standby)

## User Expectations by Use Case

### Casual Listening (2-3 friends)
- Expect: Everyone can control, add songs, skip
- Don't need: Host-only mode, complex permissions
- Critical: Background playback, basic sync

### Listening Party (5-15 people)
- Expect: Host controls to prevent chaos
- Want: Reactions, queue visibility
- Critical: Drift compensation (more noticeable with more people), host-only mode

### Long-Distance Couples
- Expect: Reliable sync, persistent rooms
- Want: Listening history, statistics
- Critical: Network recovery, background playback

### Study Groups
- Expect: Ambient music, minimal interaction
- Want: Playlist presets, long sessions
- Critical: Background playback, stable sync

## Sources

**Confidence: MEDIUM**

Research based on training data about similar products:
- Spotify Group Session (official feature for synchronized listening)
- Discord Listen Along / Spotify integration
- JQBX (social music listening, now defunct)
- Vertigo (real-time music sync app)
- AmpMe (multi-device sync)

**Unable to verify:** Current 2026 state of these products, latest best practices, new competitors

**Recommendation:** Validate assumptions about drift compensation implementation with React Native audio library documentation (react-native-track-player, expo-av) and Socket.io time sync patterns before implementation.
