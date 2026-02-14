// shared/types/entities.ts
// Core data types shared between frontend and backend

/**
 * Room entity - represents a collaborative music session
 */
export interface Room {
  roomId: string; // 6-digit code
  hostId: string;
  members: User[];
  playlist: Track[];
  currentTrack: Track | null;
  currentTrackIndex: number;
  syncState: SyncState;
  controlMode: 'open' | 'host-only' | 'queue';
  loopMode: LoopMode; // queue loop mode
  createdAt: number;
  lastActivityAt: number;
}

/**
 * Track entity - music track metadata and audio URL
 */
export interface Track {
  trackId: string;
  title: string;
  artist: string;
  album: string;
  coverUrl: string;
  audioUrl: string;
  audioUrlExpiry: number;
  duration: number; // in milliseconds
  quality: 'standard' | 'higher' | 'exhigh' | 'lossless' | 'hires';
  addedBy?: string; // userId of who added the track
  addedAt: number;
}

/**
 * QueueItem entity - extends Track with queue-specific metadata
 */
export interface QueueItem extends Track {
  queueId: string; // unique ID for each queue entry (allows same track to be re-added)
  addedByUsername: string; // display name of who added it (for UI display)
}

/**
 * Loop mode for queue playback
 */
export type LoopMode = 'none' | 'queue';

/**
 * SyncState entity - real-time playback synchronization state
 */
export interface SyncState {
  trackId: string | null;
  status: 'playing' | 'paused' | 'loading' | 'stopped';
  seekTime: number; // in milliseconds
  serverTimestamp: number; // Unix timestamp when this state was set
  playbackRate: number; // 1.0 = normal speed
  volume: number; // 0.0 to 1.0
  updatedBy: string; // userId of who triggered the update
  version: number; // Optimistic concurrency control
}

/**
 * User entity - room participant information
 */
export interface User {
  userId: string;
  clientId: string;
  username: string;
  deviceId: string;
  deviceType: 'ios' | 'android' | 'web';
  socketId: string;
  connectionState: 'connected' | 'reconnecting' | 'disconnected';
  joinedAt: number;
  lastSeenAt: number;
  latency: number; // Average round-trip latency in ms
  timeOffset: number; // NTP-like time offset from server in ms
}

/**
 * LocalPreferences entity - client-side user preferences
 * Stored in AsyncStorage (mobile) or LocalStorage (web)
 */
export interface LocalPreferences {
  theme: 'dark' | 'light' | 'system';
  playbackHistory: Track[];
  recentRooms: { roomId: string; joinedAt: number }[];
  username: string;
  audioQualityPreference: 'auto' | 'standard' | 'higher' | 'exhigh' | 'lossless';
}

/**
 * Type guards for runtime type checking
 */
export function isValidRoomId(roomId: string): boolean {
  return /^\d{6}$/.test(roomId);
}

export function isValidQuality(quality: string): quality is Track['quality'] {
  return ['standard', 'higher', 'exhigh', 'lossless'].includes(quality);
}

export function isValidPlaybackStatus(status: string): status is SyncState['status'] {
  return ['playing', 'paused', 'loading', 'stopped'].includes(status);
}

export function isValidDeviceType(deviceType: string): deviceType is User['deviceType'] {
  return ['ios', 'android', 'web'].includes(deviceType);
}

/**
 * Validation utilities
 */
export const Validators = {
  username: (username: string): boolean => {
    return username.length >= 1 && username.length <= 20;
  },

  volume: (volume: number): boolean => {
    return volume >= 0 && volume <= 1;
  },

  playbackRate: (rate: number): boolean => {
    return rate > 0 && rate <= 2;
  },
};
