# Implementation Plan: [FEATURE]

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

多设备实时同步音乐播放器，支持 iOS/Android/Web 三端。用户可创建房间邀请他人加入，实现播放进度精准同步（< 50ms），内置 10 频段 EQ 均衡器和预设音效，采用完全匿名本地存储模式。技术栈：Bun + TypeScript + React Native 0.83.x + Expo + Socket.io + Web Audio API + React Native Track Player。核心挑战：跨平台音频引擎统一、WebSocket 实时同步算法（NTP时间校准 + 软/硬同步补偿）、网易云音乐 API 集成与缓存策略。

## Technical Context

**Language/Version**: TypeScript (strict mode), Bun runtime for backend  
**Primary Dependencies**: React Native 0.83.x, Expo SDK, Socket.io (client & server), React Native Track Player, Web Audio API, neteasecloudmusicapienhanced/api  
**Storage**: AsyncStorage (React Native) / LocalStorage (Web) for client-side preferences; In-memory (optional Redis) for server-side room state  
**Testing**: Jest for unit tests, Detox (React Native) / Playwright (Web) for E2E, Chrome DevTools & Xcode Instruments for performance  
**Target Platform**: iOS 15+, Android 10+ (API 29), Modern browsers (Chrome 90+, Safari 14+)  
**Project Type**: mobile + web (cross-platform with React Native + Expo)  
**Performance Goals**: App cold start < 2s, playback response < 300ms, sync latency < 500ms, sync drift < 50ms, EQ CPU < 15%, memory < 200MB  
**Constraints**: Multi-device real-time sync (WebSocket), offline-first local storage (no account system), audio processing real-time effects, NetEase API rate limiting & caching  
**Scale/Scope**: 50 concurrent users per room, 10k concurrent connections per server, 6-8 weeks development (2 developers), 4 user stories (P1-P4 prioritized)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### I. 简洁架构 (Simple Architecture)
- ✅ **Compliant**: 架构分为三层（UI Layer, Audio Engine, Sync Client），职责清晰，无过度抽象
- ✅ **Compliant**: 目录结构扁平（src/components, src/screens, src/services），避免深层嵌套
- ✅ **Rationale**: 播放器、音频处理、同步引擎模块独立，便于测试和维护

### II. 跨平台一致性与界面美观 (Cross-Platform Consistency & UI/UX)
- ✅ **Compliant**: 使用 React Native 0.83.x + Expo，确保 iOS/Android/Web 统一代码库
- ✅ **Compliant**: 界面设计遵循简洁美观原则，规格中已定义主色调、圆角、阴影等视觉规范
- ✅ **Compliant**: 操作流程设计清晰（创建/加入房间仅需 2-3 步），交互反馈明确（按钮动画、Toast 提示）
- ✅ **Rationale**: 跨平台 UI 一致性是核心用户体验，规格第 186-234 行明确了 UI/UX 设计指导

### III. 实时同步优先 (Real-Time Sync First)
- ✅ **Compliant**: 使用 Socket.io 实现 WebSocket 双向通信，NFR-003 要求同步延迟 < 500ms
- ✅ **Compliant**: 实现 NTP-like 时间校准算法（FR-008）和软/硬同步补偿算法（FR-009）
- ✅ **Compliant**: 离线状态自动重连和进度恢复机制（FR-014）
- ✅ **Rationale**: 多设备同步是产品核心差异化功能，规格已提供详细算法伪代码

### IV. 音质增强标准 (Audio Enhancement Standards)
- ✅ **Compliant**: 10 频段 EQ 均衡器（FR-002），预设音效场景（FR-003）
- ⚠️ **Partial Compliance**: HRTF 空间音效降为 P4 增强功能（非 MVP），P1 仅实现 EQ
- ✅ **Compliant**: EQ CPU 占用限制 < 15%（NFR-005），使用 Web Audio API BiquadFilterNode
- ✅ **Rationale**: EQ 均衡器是 P1 必需功能，空间音效按章程允许分阶段实现

### V. 代码质量与可维护性 (Code Quality & Maintainability)
- ✅ **Compliant**: TypeScript strict 模式（规格已声明），Bun 作为运行时和包管理器
- ✅ **Compliant**: 代码规范明确（PascalCase 组件、camelCase 函数、UPPER_SNAKE_CASE 常量）
- ✅ **Compliant**: 核心逻辑（同步算法、时间校准）需有单元测试（Testing Strategy 章节已定义）
- ✅ **Rationale**: 章程 V 要求已在规格技术约束和开发标准中完整体现

### Gate Result: ✅ PASS

**Summary**: 所有核心原则符合要求。唯一偏差是 HRTF 空间音效作为 P4 功能延后实现，但这符合章程允许的分阶段实现策略（规格中已明确说明 P1 仅实现 EQ，空间音效为后续增强）。技术栈完全符合章程标准（Bun + TypeScript + React Native 0.83.x + Socket.io + Web Audio API）。

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Mobile + Web (React Native + Expo)
app/                     # React Native mobile app (iOS/Android)
├── src/
│   ├── components/      # Reusable UI components (PlayButton, ProgressBar, etc.)
│   ├── screens/         # Screen-level components (HomeScreen, PlayerScreen, RoomScreen, EQScreen)
│   ├── services/        # Business logic services
│   │   ├── audio/       # Audio engine (TrackPlayer wrapper, EQ effects)
│   │   ├── sync/        # Sync client (Socket.io, time calibration, drift compensation)
│   │   ├── storage/     # Local storage (AsyncStorage wrapper for preferences, history)
│   │   └── music/       # NetEase Music API integration (search, track info)
│   ├── hooks/           # Custom React hooks (usePlayer, useRoom, useSync, useEQ)
│   ├── types/           # TypeScript type definitions (Room, Track, SyncState, EQPreset)
│   ├── utils/           # Utility functions (formatDuration, generateRoomId)
│   └── constants/       # Constants (API_BASE_URL, EQ_FREQUENCIES, MAX_ROOM_SIZE)
├── assets/              # Static resources (images, fonts, splash screen)
└── tests/
    ├── unit/            # Unit tests (sync algorithms, time calibration, EQ logic)
    └── e2e/             # E2E tests (Detox for mobile flows)

web/                     # Web version (Expo Web or standalone React)
├── src/                 # Shared structure with app/ (components, screens, services)
└── tests/
    └── e2e/             # E2E tests (Playwright for web flows)

backend/                 # Backend server (Bun + Socket.io)
├── src/
│   ├── services/
│   │   ├── room/        # Room manager (create, join, member management)
│   │   ├── sync/        # Sync engine (state broadcast, time sync responses)
│   │   └── music/       # NetEase API proxy (with caching layer)
│   ├── types/           # Shared types (Room, User, SyncState, socket events)
│   ├── utils/           # Utility functions (room ID generation, validation)
│   └── server.ts        # Main server entry point
└── tests/
    ├── unit/            # Unit tests (room logic, sync algorithms)
    └── integration/     # Integration tests (Socket.io message flows)

shared/                  # Shared types and constants across frontend/backend
├── types/               # Common TypeScript interfaces (Room, Track, SyncState)
├── constants/           # Shared constants (socket event names, sync thresholds)
└── contracts/           # API contracts (will be generated in Phase 1)
```

**Structure Decision**: Selected Option 3 (Mobile + API) with web extension. This project is primarily a React Native cross-platform app (iOS/Android) with Expo, plus a web version using Expo Web. The backend is a lightweight Socket.io server for real-time sync. The `shared/` directory contains TypeScript types and constants used by both frontend and backend to ensure type safety across the WebSocket boundary.

---

## Complexity Tracking

**No violations to justify** - All design decisions comply with constitution principles.

---

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design (data model, contracts, quickstart)*

### I. 简洁架构 ✅
- **Verification**: Project structure (above) shows clear separation: `app/`, `web/`, `backend/`, `shared/`
- **Module boundaries**: Audio engine (`services/audio/`), Sync client (`services/sync/`), Music API (`services/music/`) are isolated
- **No over-abstraction**: Direct Socket.io usage without unnecessary wrapper layers
- **Status**: ✅ PASS - Design maintains simplicity

### II. 跨平台一致性与界面美观 ✅
- **Verification**: `app/src/` and `web/src/` share components, screens, services structure
- **UI consistency**: Quickstart defines unified StyleSheet patterns (colors, fonts, spacing)
- **Navigation**: React Navigation for mobile, same component hierarchy for web
- **Status**: ✅ PASS - Design ensures cross-platform consistency

### III. 实时同步优先 ✅
- **Verification**: Socket.io contracts defined in [contracts/socket-events.md](contracts/socket-events.md)
- **Time sync**: NTP-like algorithm specified in research.md, implemented in `services/sync/`
- **Drift correction**: Soft/hard sync thresholds (50ms/100ms) documented
- **Status**: ✅ PASS - Real-time sync is architectural priority

### IV. 音质增强标准 ⚠️ (with justification)
- **P1 Compliance**: 10-band EQ specified in data model, Web Audio API BiquadFilterNode chain
- **P4 Deferral**: HRTF spatial audio (User Story 4) postponed to post-MVP
- **Justification**: Spec explicitly states "P1 仅实现 EQ 均衡器，空间音效降为后续增强功能" (lines 24-25)
- **Status**: ⚠️ PARTIAL - EQ compliant, spatial audio deferred per spec prioritization

### V. 代码质量与可维护性 ✅
- **TypeScript strict**: Confirmed in Technical Context, all types defined in `shared/types/`
- **Bun runtime**: Backend uses Bun (quickstart shows `bun run src/server.ts`)
- **Testing structure**: Unit/integration/e2e test directories defined in project structure
- **Status**: ✅ PASS - Quality standards embedded in design

### Final Gate Result: ✅ PASS (with P4 deferral noted)

**Summary**: Post-design evaluation confirms all constitution principles are satisfied. The only deviation (HRTF spatial audio as P4) was explicitly approved in the original spec's prioritization strategy. All core principles (I-V) are reflected in:
- Project structure (simple, modular)
- Data model (typed, cross-platform entities)
- Contracts (well-defined Socket.io and REST APIs)
- Quickstart (clear development workflow)

**No complexity violations** - Design uses standard patterns (Socket.io, React Native Track Player, Web Audio API) without introducing unnecessary abstractions.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
