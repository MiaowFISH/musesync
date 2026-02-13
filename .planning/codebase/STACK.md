# Technology Stack

**Analysis Date:** 2026-02-14

## Languages

**Primary:**
- TypeScript 5.9.3 - Used across all workspaces (app, backend, shared)
- JavaScript - Build and configuration files

**Secondary:**
- Kotlin/Java - Android native code (via Expo Prebuild)
- Swift/Objective-C - iOS native code (via Expo Prebuild)

## Runtime

**Environment:**
- Node.js (version not pinned, inferred from package.json type: "module")

**Package Manager:**
- Yarn 4.12.0 (specified in `.yarnrc.yml`)
- Lockfile: `yarn.lock` (present)

## Frameworks

**Core:**
- Expo 54.0.30 - React Native framework for iOS/Android/Web
- React 19.1.0 - UI library
- React Native 0.81.5 - Native mobile framework
- Express 4.18.2 - Backend HTTP server

**Routing & Navigation:**
- Expo Router 6.0.21 - File-based routing for Expo
- React Navigation 7.1.8 - Native navigation
- React Navigation Native Stack 7.3.16 - Stack navigation

**Real-time Communication:**
- Socket.io 4.6.1 - Backend WebSocket server
- Socket.io-client 4.8.3 - Frontend WebSocket client

**Audio & Media:**
- Expo Audio 1.1.1 - Audio playback API
- React Native Track Player 4.1.2 - Advanced audio playback control
- Shaka Player 5.0.1 - DASH/HLS media player

**Testing:**
- No test framework detected in package.json

**Build/Dev:**
- Turbo 2.8.7 - Monorepo task orchestration
- oxlint 1.47.0 - Fast linter (Rust-based)
- oxfmt 0.32.0 - Code formatter (Rust-based)
- tsx 4.21.0 - TypeScript execution for Node.js
- TypeScript 5.9.3 - Type checking

## Key Dependencies

**Critical:**
- `@neteasecloudmusicapienhanced/api` 4.29.20 - NetEase Cloud Music API client (backend music source)
- `socket.io` 4.6.1 - Real-time sync between clients
- `socket.io-client` 4.8.3 - Client-side WebSocket connection

**Infrastructure:**
- `cors` 2.8.5 - CORS middleware for Express
- `@react-native-async-storage/async-storage` 2.2.0 - Local persistent storage
- `react-native-safe-area-context` 5.6.2 - Safe area handling
- `react-native-screens` 4.16.0 - Native screen management
- `react-native-web` 0.21.0 - React Native for web

**Development:**
- `@types/node` 20.11.5 - Node.js type definitions
- `@types/express` 4.17.21 - Express type definitions
- `@types/cors` 2.8.17 - CORS type definitions
- `@types/react` 19.1.10 - React type definitions
- `@types/react-native-web` 0.19.2 - React Native Web types

## Configuration

**Environment:**
- `EXPO_PUBLIC_API_URL` - Frontend API endpoint (defaults to `http://localhost:3000`)
- `PORT` - Backend server port (defaults to 3000)
- `CORS_ORIGIN` - CORS allowed origins (defaults to `*`)
- `NODE_ENV` - Environment mode (development/production)

**Build:**
- `app/app.config.ts` - Expo configuration (app name, version, plugins, permissions)
- `app/tsconfig.json` - TypeScript config for app workspace
- `backend/tsconfig.json` - TypeScript config for backend workspace
- `.oxlintrc.json` - Oxlint configuration with ESLint/TypeScript/React plugins
- `.yarnrc.yml` - Yarn configuration (node-modules linker, yarn path)

**Expo Plugins:**
- `expo-router` - File-based routing
- `./expo-plugins/withAppBuildGradle` - Custom Android Gradle config
- `./expo-plugins/withGradleProperties` - Custom Gradle properties
- `./expo-plugins/withProjectBuildGradle` - Custom project Gradle config

## Platform Requirements

**Development:**
- Node.js with Yarn 4.12.0
- Expo CLI (via `@expo/cli@54.0.20` with patch)
- Android SDK (for Android development)
- Xcode (for iOS development)

**Production:**
- Deployment target: iOS 13+, Android 5.0+ (inferred from Expo 54)
- Backend: Node.js server
- Audio streaming: Requires internet connectivity for NetEase API

---

*Stack analysis: 2026-02-14*
