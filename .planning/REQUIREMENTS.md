# Requirements: MusicTogether

**Defined:** 2026-02-14
**Core Value:** 多设备之间的播放状态实时同步 — 一个人按下播放，所有人同时听到音乐。

## v1 Requirements

Requirements for current milestone. Each maps to roadmap phases.

### Playlist Management (PLST)

- [ ] **PLST-01**: User can view current playback queue (current song + upcoming songs)
- [ ] **PLST-02**: User can add songs to the queue from search results
- [ ] **PLST-03**: User can remove songs from the queue
- [ ] **PLST-04**: User can reorder queue by drag-and-drop
- [ ] **PLST-05**: Queue changes sync to all room members in real-time via Socket.io
- [ ] **PLST-06**: Queue automatically advances to next song when current song ends

### Background Playback (BGPB)

- [ ] **BGPB-01**: Music continues playing when app is moved to background on iOS
- [ ] **BGPB-02**: Music continues playing when app is moved to background on Android
- [ ] **BGPB-03**: Lock screen shows playback controls (play/pause/skip) on both platforms
- [ ] **BGPB-04**: App reconciles sync state when returning to foreground (fetches authoritative state from server)

### Network Recovery (NETR)

- [ ] **NETR-01**: App detects network disconnection and displays status to user
- [ ] **NETR-02**: App automatically reconnects and rejoins room after network recovery
- [ ] **NETR-03**: Playback position resyncs to room state after reconnection
- [ ] **NETR-04**: Stale state is rejected (state older than 60s not propagated to other clients)
- [ ] **NETR-05**: Heartbeat timeout is enforced server-side (disconnect inactive clients)

### Control Modes (CTRL)

- [ ] **CTRL-01**: Room creator can switch between three control modes: host-only, open, and queue
- [ ] **CTRL-02**: In host-only mode, only host can play/pause/seek/skip
- [ ] **CTRL-03**: In open mode, any member can control playback (current behavior)
- [ ] **CTRL-04**: In queue mode, any member can add songs; system plays in order with upvote-based reordering
- [ ] **CTRL-05**: Non-host users see disabled controls with clear indication in host-only mode
- [ ] **CTRL-06**: Server enforces permission checks per control mode (rejects unauthorized events)
- [ ] **CTRL-07**: Control mode change is broadcast to all room members in real-time

### Bug Fixes (BUGF)

- [ ] **BUGF-01**: Fix version number reset on track change (blocks playlist sync)
- [ ] **BUGF-02**: Fix socket ID race condition on reconnection

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Sync Quality

- **SYNC-01**: Drift compensation with tiered correction strategy (<50ms target accuracy)
- **SYNC-02**: Soft sync via ±5% playback rate adjustment for 500ms-3s drift
- **SYNC-03**: Hard sync via fade-out/seek/fade-in for >3s drift

### Theme

- **THME-01**: Light theme color palette
- **THME-02**: Theme toggle in settings (dark/light)
- **THME-03**: Theme preference persisted to local storage

### Social

- **SOCL-01**: Collaborative playlist editing (vote on next track)
- **SOCL-02**: Reaction system (emoji reactions to current song)

### Polish

- **PLSH-01**: Cross-fade between songs
- **PLSH-02**: Lyrics sync display
- **PLSH-03**: Room persistence across sessions

## Out of Scope

| Feature | Reason |
|---------|--------|
| User accounts / authentication | 产品定位为匿名本地存储，降低复杂度 |
| In-app chat | 不是核心功能，用户可用其他通讯工具 |
| Music upload / hosting | 法律风险，存储成本，版权问题 |
| Video sync | 超出产品范围，完全不同的产品形态 |
| Advanced DJ features (loops, samples) | 小众需求，高复杂度 |
| Social network features (profiles, friends) | 与匿名设计原则冲突 |
| Multi music source support | 当前仅网易云音乐，后续可扩展 |
| HRTF spatial audio | 实现复杂度高，延后到核心功能稳定后 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLST-01 | — | Pending |
| PLST-02 | — | Pending |
| PLST-03 | — | Pending |
| PLST-04 | — | Pending |
| PLST-05 | — | Pending |
| PLST-06 | — | Pending |
| BGPB-01 | — | Pending |
| BGPB-02 | — | Pending |
| BGPB-03 | — | Pending |
| BGPB-04 | — | Pending |
| NETR-01 | — | Pending |
| NETR-02 | — | Pending |
| NETR-03 | — | Pending |
| NETR-04 | — | Pending |
| NETR-05 | — | Pending |
| CTRL-01 | — | Pending |
| CTRL-02 | — | Pending |
| CTRL-03 | — | Pending |
| CTRL-04 | — | Pending |
| CTRL-05 | — | Pending |
| CTRL-06 | — | Pending |
| CTRL-07 | — | Pending |
| BUGF-01 | — | Pending |
| BUGF-02 | — | Pending |

**Coverage:**
- v1 requirements: 24 total
- Mapped to phases: 0
- Unmapped: 24 ⚠️

---
*Requirements defined: 2026-02-14*
*Last updated: 2026-02-14 after initial definition*
