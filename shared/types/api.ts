// shared/types/api.ts
// REST API type definitions for NetEase Music proxy endpoints

import type { Track } from './entities';

// ============================================================================
// Common Response Wrapper
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  cached?: boolean;
  cacheExpiry?: number;
}

export interface ApiError {
  code: string;
  message: string;
  retryAfter?: number;
  availableQualities?: string[];
}

// ============================================================================
// Search Endpoint
// ============================================================================

export interface SearchQuery {
  keyword: string;
  limit?: number; // default 20, max 100
  offset?: number; // default 0
  type?: number; // default 1 (songs)
}

export interface SearchResult {
  songs: SearchSong[];
  totalCount: number;
}

export interface SearchSong {
  trackId: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  duration: number; // milliseconds
  fee: number; // 0=free, 1=vip, 4=paid, 8=limited
}

// ============================================================================
// Song Detail Endpoint
// ============================================================================

export interface SongDetail {
  trackId: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  duration: number;
  fee: number;
  popularity: number; // 0-100
  publishTime: number; // Unix timestamp
  lyrics?: {
    lrc: string; // LRC format
    tlyric?: string; // Translated lyrics
  };
}

// ============================================================================
// Audio URL Endpoint
// ============================================================================

export interface AudioUrlQuery {
  quality?: 'standard' | 'higher' | 'exhigh' | 'lossless' | 'hires';
  refresh?: boolean;
}

export interface AudioUrlResult {
  trackId: string;
  audioUrl: string;
  audioUrlExpiry: number; // Unix timestamp
  quality: 'standard' | 'higher' | 'exhigh' | 'lossless' | 'hires';
  bitrate: number; // bits per second
  size?: number; // bytes (optional)
  type?: string; // 'mp3', 'flac', etc. (optional)
  isTrial?: boolean; // true if this is a free trial version (VIP-only song)
  trialStart?: number; // trial start time in ms (for VIP songs)
  trialEnd?: number; // trial end time in ms (for VIP songs)
}

// ============================================================================
// Batch Audio URL Endpoint
// ============================================================================

export interface BatchAudioUrlRequest {
  trackIds: string[]; // max 10
  quality?: 'standard' | 'higher' | 'exhigh' | 'lossless';
}

export interface BatchAudioUrlResult {
  results: Array<{
    trackId: string;
    success: boolean;
    data?: AudioUrlResult;
    error?: {
      code: string;
      message: string;
    };
  }>;
}

// ============================================================================
// Health Check Endpoint
// ============================================================================

export interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'down';
  timestamp: number;
  services: {
    netease: 'ok' | 'degraded' | 'down';
    cache: 'ok' | 'down';
    database?: 'ok' | 'down';
  };
  uptime: number; // seconds
  version: string;
}

// ============================================================================
// Error Codes
// ============================================================================

export const API_ERROR_CODES = {
  // Search errors
  INVALID_KEYWORD: 'INVALID_KEYWORD',
  
  // Song errors
  SONG_NOT_FOUND: 'SONG_NOT_FOUND',
  INVALID_TRACK_ID: 'INVALID_TRACK_ID',
  
  // Audio errors
  AUDIO_NOT_AVAILABLE: 'AUDIO_NOT_AVAILABLE',
  QUALITY_NOT_AVAILABLE: 'QUALITY_NOT_AVAILABLE',
  REGION_RESTRICTED: 'REGION_RESTRICTED',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // NetEase API errors
  NETEASE_API_ERROR: 'NETEASE_API_ERROR',
  NETEASE_API_TIMEOUT: 'NETEASE_API_TIMEOUT',
  
  // Server errors
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
} as const;

// ============================================================================
// Type Guards
// ============================================================================

export function isApiResponse<T>(data: unknown): data is ApiResponse<T> {
  const d = data as ApiResponse<T>;
  return typeof d?.success === 'boolean';
}

export function isSearchResult(data: unknown): data is SearchResult {
  const d = data as SearchResult;
  return Array.isArray(d?.songs) && typeof d?.totalCount === 'number';
}

export function isAudioUrlResult(data: unknown): data is AudioUrlResult {
  const d = data as AudioUrlResult;
  return (
    typeof d?.trackId === 'string' &&
    typeof d?.audioUrl === 'string' &&
    typeof d?.audioUrlExpiry === 'number'
  );
}
