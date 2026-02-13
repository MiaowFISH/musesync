// shared/constants/index.ts
// Shared constants used across frontend and backend

/**
 * Socket.io Event Names
 * Follow naming convention: namespace:action
 * - Client → Server: imperative (e.g., 'room:create')
 * - Server → Client: past tense (e.g., 'room:created')
 * - Broadcast: descriptive (e.g., 'sync:state')
 */
export const SOCKET_EVENTS = {
  // Room management
  ROOM_CREATE: 'room:create',
  ROOM_CREATED: 'room:created',
  ROOM_JOIN: 'room:join',
  ROOM_JOINED: 'room:joined',
  ROOM_MEMBER_JOINED: 'room:member_joined',
  ROOM_LEAVE: 'room:leave',
  ROOM_LEFT: 'room:left',
  ROOM_MEMBER_LEFT: 'room:member_left',
  ROOM_CONTROL_MODE_CHANGED: 'room:control_mode_changed',
  
  // Sync & playback
  SYNC_PLAY: 'sync:play',
  SYNC_PAUSE: 'sync:pause',
  SYNC_SEEK: 'sync:seek',
  SYNC_NEXT: 'sync:next',
  SYNC_PREVIOUS: 'sync:previous',
  SYNC_STATE: 'sync:state',
  SYNC_PLAYLIST_ADD: 'sync:playlist_add',
  SYNC_PLAYLIST_REMOVE: 'sync:playlist_remove',
  SYNC_PLAYLIST_REORDER: 'sync:playlist_reorder',
  SYNC_PLAYLIST_UPDATED: 'sync:playlist_updated',
  
  // Time synchronization
  TIME_SYNC_REQUEST: 'time:sync_request',
  TIME_SYNC_RESPONSE: 'time:sync_response',
  
  // Errors
  ERROR_PERMISSION_DENIED: 'error:permission_denied',
  ERROR_RATE_LIMIT: 'error:rate_limit',
  ERROR_INVALID_REQUEST: 'error:invalid_request',
} as const;

/**
 * Synchronization Thresholds
 * Used for drift detection and correction in real-time playback
 */
export const SYNC_THRESHOLDS = {
  /** 
   * Soft sync threshold (50ms)
   * If drift exceeds this, apply gradual playback rate adjustment
   * Adjustment range: 0.97x - 1.03x
   */
  SOFT_SYNC_THRESHOLD_MS: 50,
  
  /**
   * Hard sync threshold (100ms)
   * If drift exceeds this, apply immediate seek correction
   */
  HARD_SYNC_THRESHOLD_MS: 100,
  
  /**
   * Drift check interval (100ms)
   * How often to check for playback drift
   */
  DRIFT_CHECK_INTERVAL_MS: 100,
  
  /**
   * Time sync interval (30 seconds)
   * How often to perform NTP-like time synchronization with server
   */
  TIME_SYNC_INTERVAL_MS: 30000,
  
  /**
   * Playback response target (300ms)
   * Expected time from user action to playback start
   */
  PLAYBACK_RESPONSE_TARGET_MS: 300,
  
  /**
   * Maximum acceptable sync latency (500ms)
   * Target worst-case synchronization delay across all clients
   */
  MAX_SYNC_LATENCY_MS: 500,
  
  /**
   * Soft sync playback rate range
   */
  MIN_PLAYBACK_RATE: 0.97,
  MAX_PLAYBACK_RATE: 1.03,
} as const;

/**
 * Room Configuration
 */
export const ROOM_CONFIG = {
  /** Maximum members per room */
  MAX_MEMBERS: 10,
  
  /** Room ID length (6 digits) */
  ROOM_ID_LENGTH: 6,
  
  /** Room inactivity timeout (1 hour) */
  ROOM_TIMEOUT_MS: 3600000,
  
  /** Room cleanup interval (5 minutes) */
  ROOM_CLEANUP_INTERVAL_MS: 300000,
} as const;

/**
 * Audio Configuration
 */
export const AUDIO_CONFIG = {
  /** Volume range */
  MIN_VOLUME: 0,
  MAX_VOLUME: 1,

  /** Available audio quality levels */
  QUALITY_LEVELS: ['standard', 'higher', 'exhigh', 'lossless'] as const,

  /** Audio URL refresh threshold (5 minutes before expiry) */
  AUDIO_URL_REFRESH_THRESHOLD_MS: 300000,
} as const;

/**
 * Network Configuration
 */
export const NETWORK_CONFIG = {
  /** Socket.io ping interval */
  PING_INTERVAL_MS: 25000,
  
  /** Socket.io ping timeout */
  PING_TIMEOUT_MS: 60000,
  
  /** Reconnection delay (initial) */
  RECONNECT_DELAY_MS: 1000,
  
  /** Reconnection delay (max) */
  RECONNECT_DELAY_MAX_MS: 5000,
  
  /** Maximum reconnection attempts */
  RECONNECT_ATTEMPTS: 5,
  
  /** Request timeout */
  REQUEST_TIMEOUT_MS: 10000,
  
  /** Rate limit window (1 minute) */
  RATE_LIMIT_WINDOW_MS: 60000,
  
  /** Maximum requests per window */
  RATE_LIMIT_MAX_REQUESTS: 60,
} as const;

/**
 * Performance Targets (from NFR)
 */
export const PERFORMANCE_TARGETS = {
  /** Cold start time target */
  COLD_START_TARGET_MS: 2000,
  
  /** Playback response target */
  PLAYBACK_RESPONSE_TARGET_MS: 300,
  
  /** Maximum sync latency */
  MAX_SYNC_LATENCY_MS: 500,
  
  /** Maximum playback drift */
  MAX_DRIFT_MS: 50,

  /** Memory usage target */
  MEMORY_TARGET_MB: 200,
} as const;

/**
 * Validation Rules
 */
export const VALIDATION = {
  /** Username length range */
  USERNAME_MIN_LENGTH: 1,
  USERNAME_MAX_LENGTH: 20,
  
  /** Device ID max length */
  DEVICE_ID_MAX_LENGTH: 255,
  
  /** Room ID pattern */
  ROOM_ID_PATTERN: /^\d{6}$/,
  
  /** Track ID pattern (NetEase uses numeric IDs) */
  TRACK_ID_PATTERN: /^\d+$/,
  
  /** User ID pattern (UUID v4) */
  USER_ID_PATTERN: /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
} as const;

/**
 * Storage Keys (for AsyncStorage/LocalStorage)
 */
export const STORAGE_KEYS = {
  LOCAL_PREFERENCES: 'musictogether:preferences',
  PLAYBACK_HISTORY: 'musictogether:history',
  RECENT_ROOMS: 'musictogether:recent_rooms',
  DEVICE_ID: 'musictogether:device_id',
  USER_ID: 'musictogether:user_id',
} as const;

/**
 * API Endpoints (NetEase Cloud Music API)
 */
export const API_ENDPOINTS = {
  SEARCH: '/cloudsearch',
  SONG_DETAIL: '/song/detail',
  SONG_URL: '/song/url/v1',
  LYRIC: '/lyric',
  PLAYLIST_DETAIL: '/playlist/detail',
} as const;

/**
 * Type exports for compile-time safety
 */
export type SocketEventName = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];
export type QualityLevel = typeof AUDIO_CONFIG.QUALITY_LEVELS[number];
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

/**
 * Error Codes
 */
export const ERROR_CODES = {
  // Room errors
  ROOM_NOT_FOUND: 'ROOM_NOT_FOUND',
  ROOM_FULL: 'ROOM_FULL',
  INVALID_ROOM_CODE: 'INVALID_ROOM_CODE',
  CREATION_FAILED: 'CREATION_FAILED',
  
  // Permission errors
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  HOST_ONLY_MODE: 'HOST_ONLY_MODE',
  
  // Network errors
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  TIMEOUT: 'TIMEOUT',
  
  // Playback errors
  TRACK_NOT_FOUND: 'TRACK_NOT_FOUND',
  AUDIO_URL_EXPIRED: 'AUDIO_URL_EXPIRED',
  PLAYBACK_ERROR: 'PLAYBACK_ERROR',
  
  // Validation errors
  INVALID_REQUEST: 'INVALID_REQUEST',
  INVALID_STATE: 'INVALID_STATE',
} as const;

/**
 * API Error Codes (NetEase Music API)
 */
export const API_ERROR_CODES = {
  // Request validation
  INVALID_KEYWORD: 'INVALID_KEYWORD',
  INVALID_TRACK_ID: 'INVALID_TRACK_ID',
  INVALID_REQUEST: 'INVALID_REQUEST',
  
  // NetEase API errors
  NETEASE_API_ERROR: 'NETEASE_API_ERROR',
  SONG_NOT_FOUND: 'SONG_NOT_FOUND',
  AUDIO_NOT_AVAILABLE: 'AUDIO_NOT_AVAILABLE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Cache/Network errors
  CACHE_ERROR: 'CACHE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
} as const;

/**
 * Type exports for compile-time safety
 */
export type SocketEventName = typeof SOCKET_EVENTS[keyof typeof SOCKET_EVENTS];
export type QualityLevel = typeof AUDIO_CONFIG.QUALITY_LEVELS[number];
export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];
