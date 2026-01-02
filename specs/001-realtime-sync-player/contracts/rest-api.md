# REST API Contracts (NetEase Music Proxy)

**Feature**: 001-realtime-sync-player  
**Base URL**: `https://api.musictogether.app` (or local dev `http://localhost:3000`)  
**Date**: 2026-01-02

## Overview

The backend provides a proxy layer to the NetEase Cloud Music API (`neteasecloudmusicapienhanced/api` npm package), adding:
- Caching (24h for metadata, 20min for audio URLs)
- Rate limiting (10 req/min per IP)
- Error handling and retries
- Response normalization

All endpoints return JSON. Audio streaming is handled by direct client access to NetEase CDN URLs (not proxied).

---

## Authentication

**None required** - Fully anonymous API. NetEase Music API cookies handled internally by proxy.

---

## Search

### `GET /api/music/search`

**Purpose**: Search for songs by keyword  
**Rate Limit**: 10 requests per 60 seconds per IP

**Query Parameters**:
- `keyword` (required): Search query string (URL-encoded)
- `limit` (optional): Max results, default 20, max 100
- `offset` (optional): Pagination offset, default 0
- `type` (optional): Search type, default 1 (songs)

**Response**:
```typescript
{
  success: true;
  data: {
    songs: Array<{
      trackId: string;       // NetEase song ID
      title: string;
      artist: string;        // Combined artist names with " / "
      album: string;
      coverUrl: string;      // Album cover image URL (HTTPS)
      duration: number;      // Duration in milliseconds
      fee: number;           // 0=free, 1=vip, 4=paid, 8=limited
    }>;
    totalCount: number;      // Total matching songs
  };
  cached: boolean;           // Whether response came from cache
  cacheExpiry: number;       // Unix timestamp when cache expires
}
```

**Error Response**:
```typescript
{
  success: false;
  error: {
    code: 'INVALID_KEYWORD' | 'RATE_LIMIT_EXCEEDED' | 'NETEASE_API_ERROR';
    message: string;
    retryAfter?: number;     // Seconds to wait (for rate limit)
  };
}
```

**Example Request**:
```bash
GET /api/music/search?keyword=%E6%B5%B7%E9%98%94%E5%A4%A9%E7%A9%BA&limit=10
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "songs": [
      {
        "trackId": "347230",
        "title": "海阔天空",
        "artist": "Beyond",
        "album": "乐与怒",
        "coverUrl": "https://p1.music.126.net/...",
        "duration": 326000,
        "fee": 0
      }
    ],
    "totalCount": 1247
  },
  "cached": false,
  "cacheExpiry": 1735718400000
}
```

**Caching**: 24 hours (86400 seconds)

---

## Song Detail

### `GET /api/music/song/:trackId`

**Purpose**: Get detailed metadata for a specific song  
**Rate Limit**: 10 requests per 60 seconds per IP

**Path Parameters**:
- `trackId` (required): NetEase song ID

**Query Parameters**:
- None

**Response**:
```typescript
{
  success: true;
  data: {
    trackId: string;
    title: string;
    artist: string;
    album: string;
    coverUrl: string;
    duration: number;
    fee: number;
    popularity: number;      // 0-100 popularity score
    publishTime: number;     // Unix timestamp
    lyrics?: {               // Optional lyrics
      lrc: string;           // LRC format lyrics
      tlyric?: string;       // Translated lyrics (if available)
    };
  };
  cached: boolean;
  cacheExpiry: number;
}
```

**Error Response**:
```typescript
{
  success: false;
  error: {
    code: 'SONG_NOT_FOUND' | 'INVALID_TRACK_ID' | 'RATE_LIMIT_EXCEEDED';
    message: string;
  };
}
```

**Example Request**:
```bash
GET /api/music/song/347230
```

**Caching**: 24 hours (86400 seconds)

---

## Audio URL

### `GET /api/music/audio/:trackId`

**Purpose**: Get streaming audio URL for a song  
**Rate Limit**: 20 requests per 60 seconds per IP (higher limit due to expiry refresh)

**Path Parameters**:
- `trackId` (required): NetEase song ID

**Query Parameters**:
- `quality` (optional): Audio quality level, default 'exhigh'
  - Allowed values: `standard`, `higher`, `exhigh`, `lossless`, `hires`
- `refresh` (optional): Force bypass cache, default false

**Response**:
```typescript
{
  success: true;
  data: {
    trackId: string;
    audioUrl: string;        // Direct CDN URL (HTTPS)
    audioUrlExpiry: number;  // Unix timestamp (~20 minutes from now)
    quality: 'standard' | 'higher' | 'exhigh' | 'lossless' | 'hires';
    bitrate: number;         // Bits per second (e.g., 320000 for 320kbps)
    size: number;            // File size in bytes
    type: string;            // File format (e.g., 'mp3', 'flac')
  };
  cached: boolean;
  cacheExpiry: number;
}
```

**Error Response**:
```typescript
{
  success: false;
  error: {
    code: 'AUDIO_NOT_AVAILABLE' | 'QUALITY_NOT_AVAILABLE' | 'REGION_RESTRICTED' | 'RATE_LIMIT_EXCEEDED';
    message: string;
    availableQualities?: string[];  // If quality not available, list what is
  };
}
```

**Example Request**:
```bash
GET /api/music/audio/347230?quality=exhigh
```

**Example Response**:
```json
{
  "success": true,
  "data": {
    "trackId": "347230",
    "audioUrl": "https://m701.music.126.net/...",
    "audioUrlExpiry": 1735716000000,
    "quality": "exhigh",
    "bitrate": 320000,
    "size": 13072384,
    "type": "mp3"
  },
  "cached": false,
  "cacheExpiry": 1735716000000
}
```

**Caching**: 20 minutes (1200 seconds), proactive refresh at 15 minutes

**Quality Fallback Strategy** (client-side):
1. Try requested quality
2. If 404 or `QUALITY_NOT_AVAILABLE`, try next lower quality:
   - `lossless` → `exhigh` → `higher` → `standard`
3. If all fail, show error to user

---

## Batch Operations

### `POST /api/music/batch/audio`

**Purpose**: Get audio URLs for multiple tracks in one request  
**Rate Limit**: 5 requests per 60 seconds per IP

**Request Body**:
```typescript
{
  trackIds: string[];      // Max 10 tracks per request
  quality?: 'standard' | 'higher' | 'exhigh' | 'lossless';
}
```

**Response**:
```typescript
{
  success: true;
  data: Array<{
    trackId: string;
    audioUrl?: string;       // Omitted if unavailable
    audioUrlExpiry?: number;
    quality?: string;
    bitrate?: number;
    size?: number;
    type?: string;
    error?: {                // If this track failed
      code: string;
      message: string;
    };
  }>;
}
```

**Example Request**:
```bash
POST /api/music/batch/audio
Content-Type: application/json

{
  "trackIds": ["347230", "347231", "347232"],
  "quality": "exhigh"
}
```

**Validation**:
- `trackIds` array length must be 1-10
- Requests with > 10 tracks return 400 Bad Request

---

## Health Check

### `GET /api/health`

**Purpose**: Check API and NetEase proxy status  
**Rate Limit**: None

**Response**:
```typescript
{
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  services: {
    netease: {
      status: 'up' | 'down';
      latency: number;       // Milliseconds
      lastChecked: number;   // Unix timestamp
    };
    cache: {
      status: 'up' | 'down';
      hitRate: number;       // 0.0 - 1.0
    };
  };
  version: string;           // API version (e.g., '1.0.0')
}
```

**Example Response**:
```json
{
  "status": "healthy",
  "timestamp": 1735715123456,
  "services": {
    "netease": {
      "status": "up",
      "latency": 142,
      "lastChecked": 1735715123000
    },
    "cache": {
      "status": "up",
      "hitRate": 0.73
    }
  },
  "version": "1.0.0"
}
```

---

## Error Codes Reference

| Code | HTTP Status | Description | User Action |
|------|-------------|-------------|-------------|
| `INVALID_KEYWORD` | 400 | Search keyword empty or malformed | Provide valid search term |
| `INVALID_TRACK_ID` | 400 | Track ID empty or invalid format | Check track ID |
| `SONG_NOT_FOUND` | 404 | Song doesn't exist in NetEase database | Try different song |
| `AUDIO_NOT_AVAILABLE` | 404 | Audio URL not available (region/licensing) | Song cannot be played |
| `QUALITY_NOT_AVAILABLE` | 404 | Requested quality not available | Use lower quality |
| `REGION_RESTRICTED` | 403 | Song not available in user's region | VPN or different song |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Wait `retryAfter` seconds |
| `NETEASE_API_ERROR` | 502 | Upstream NetEase API failure | Retry with exponential backoff |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error | Retry or report bug |

---

## Rate Limiting

**Algorithm**: Token bucket per IP address

**Limits**:
- `/api/music/search`: 10 req/min
- `/api/music/song/:id`: 10 req/min
- `/api/music/audio/:id`: 20 req/min (higher due to URL refresh)
- `/api/music/batch/audio`: 5 req/min

**Headers**:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1735715200 (Unix timestamp)
```

**429 Response**:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Try again in 23 seconds.",
    "retryAfter": 23
  }
}
```

---

## Caching Strategy

### Client-Side (AsyncStorage/LocalStorage)

- **Search results**: 30 minutes (user might search same term)
- **Song metadata**: 24 hours (rarely changes)
- **Audio URLs**: 20 minutes (matches expiry)

**Cache Key Format**:
```typescript
`music:search:${keyword}:${limit}:${offset}`
`music:song:${trackId}`
`music:audio:${trackId}:${quality}`
```

### Server-Side (In-Memory or Redis)

- **Search results**: 24 hours
- **Song metadata**: 24 hours
- **Audio URLs**: 20 minutes

**Invalidation**:
- Automatic expiry based on TTL
- No manual invalidation (music metadata rarely changes)

---

## TypeScript Type Definitions

```typescript
// shared/types/api.ts

export interface SearchRequest {
  keyword: string;
  limit?: number;
  offset?: number;
  type?: number;
}

export interface SearchResponse {
  success: boolean;
  data?: {
    songs: Array<{
      trackId: string;
      title: string;
      artist: string;
      album: string;
      coverUrl: string;
      duration: number;
      fee: number;
    }>;
    totalCount: number;
  };
  cached: boolean;
  cacheExpiry: number;
  error?: APIError;
}

export interface SongDetailResponse {
  success: boolean;
  data?: {
    trackId: string;
    title: string;
    artist: string;
    album: string;
    coverUrl: string;
    duration: number;
    fee: number;
    popularity: number;
    publishTime: number;
    lyrics?: {
      lrc: string;
      tlyric?: string;
    };
  };
  cached: boolean;
  cacheExpiry: number;
  error?: APIError;
}

export interface AudioURLResponse {
  success: boolean;
  data?: {
    trackId: string;
    audioUrl: string;
    audioUrlExpiry: number;
    quality: AudioQuality;
    bitrate: number;
    size: number;
    type: string;
  };
  cached: boolean;
  cacheExpiry: number;
  error?: APIError;
}

export type AudioQuality = 'standard' | 'higher' | 'exhigh' | 'lossless' | 'hires';

export interface APIError {
  code: string;
  message: string;
  retryAfter?: number;
  availableQualities?: string[];
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: number;
  services: {
    netease: {
      status: 'up' | 'down';
      latency: number;
      lastChecked: number;
    };
    cache: {
      status: 'up' | 'down';
      hitRate: number;
    };
  };
  version: string;
}
```

---

**Version**: 1.0.0  
**Generated**: 2026-01-02  
**Next**: Implement REST handlers in `backend/src/services/music/`
