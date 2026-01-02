// shared/types/socket-events.ts
// Socket.io event type definitions for type-safe communication

import type { Room, Track, SyncState, User } from './entities';

/**
 * Socket.io Event Map
 * Defines all events and their payload types
 */
export interface SocketEvents {
  // Room management
  'room:create': (data: RoomCreateRequest) => void;
  'room:created': (data: RoomCreatedResponse) => void;
  'room:join': (data: RoomJoinRequest) => void;
  'room:joined': (data: RoomJoinedResponse) => void;
  'room:member_joined': (data: MemberJoinedEvent) => void;
  'room:leave': (data: RoomLeaveRequest) => void;
  'room:left': (data: RoomLeftResponse) => void;
  'room:member_left': (data: MemberLeftEvent) => void;
  'room:control_mode_changed': (data: ControlModeChangedEvent) => void;

  // Sync & playback
  'sync:play': (data: SyncPlayRequest) => void;
  'sync:pause': (data: SyncPauseRequest) => void;
  'sync:seek': (data: SyncSeekRequest) => void;
  'sync:next': (data: SyncNextRequest) => void;
  'sync:previous': (data: SyncPreviousRequest) => void;
  'sync:state': (data: SyncStateEvent) => void;
  'sync:playlist_add': (data: PlaylistAddRequest) => void;
  'sync:playlist_remove': (data: PlaylistRemoveRequest) => void;
  'sync:playlist_reorder': (data: PlaylistReorderRequest) => void;
  'sync:playlist_updated': (data: PlaylistUpdatedEvent) => void;

  // Time sync
  'time:sync_request': (data: TimeSyncRequest) => void;
  'time:sync_response': (data: TimeSyncResponse) => void;

  // Errors
  'error:permission_denied': (data: PermissionDeniedError) => void;
  'error:rate_limit': (data: RateLimitError) => void;
  'error:invalid_request': (data: InvalidRequestError) => void;
}

// ============================================================================
// Request Types (Client → Server)
// ============================================================================

export interface RoomCreateRequest {
  userId: string;
  username: string;
  deviceId: string;
  deviceType: 'ios' | 'android' | 'web';
}

export interface RoomJoinRequest {
  roomId: string;
  userId: string;
  username: string;
  deviceId: string;
  deviceType: 'ios' | 'android' | 'web';
}

export interface RoomLeaveRequest {
  roomId: string;
  userId: string;
}

export interface SyncPlayRequest {
  roomId: string;
  userId: string;
  trackId: string;
  seekTime: number;
}

export interface SyncPauseRequest {
  roomId: string;
  userId: string;
  seekTime: number;
}

export interface SyncSeekRequest {
  roomId: string;
  userId: string;
  seekTime: number;
}

export interface SyncNextRequest {
  roomId: string;
  userId: string;
}

export interface SyncPreviousRequest {
  roomId: string;
  userId: string;
}

export interface PlaylistAddRequest {
  roomId: string;
  userId: string;
  track: Track;
}

export interface PlaylistRemoveRequest {
  roomId: string;
  userId: string;
  trackId: string;
}

export interface PlaylistReorderRequest {
  roomId: string;
  userId: string;
  fromIndex: number;
  toIndex: number;
}

export interface TimeSyncRequest {
  clientTimestamp: number;
}

// ============================================================================
// Response/Event Types (Server → Client)
// ============================================================================

export interface RoomCreatedResponse {
  success: boolean;
  room?: Room;
  error?: {
    code: 'CREATION_FAILED' | 'RATE_LIMIT_EXCEEDED';
    message: string;
  };
}

export interface RoomJoinedResponse {
  success: boolean;
  room?: Room;
  error?: {
    code: 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'INVALID_ROOM_CODE';
    message: string;
  };
}

export interface RoomLeftResponse {
  success: boolean;
  error?: {
    code: string;
    message: string;
  };
}

export interface MemberJoinedEvent {
  user: User;
  totalMembers: number;
}

export interface MemberLeftEvent {
  userId: string;
  username: string;
  totalMembers: number;
  newHostId?: string;
}

export interface ControlModeChangedEvent {
  controlMode: 'open' | 'host-only';
  changedBy: string;
}

export interface SyncStateEvent {
  roomId: string;
  syncState: SyncState;
  currentTrack: Track | null;
}

export interface PlaylistUpdatedEvent {
  roomId: string;
  playlist: Track[];
  currentTrackIndex: number;
  updatedBy: string;
}

export interface TimeSyncResponse {
  clientTimestamp: number;
  serverReceiveTime: number;
  serverSendTime: number;
}

// ============================================================================
// Error Types
// ============================================================================

export interface PermissionDeniedError {
  operation: string;
  reason: 'HOST_ONLY_MODE' | 'ROOM_FULL' | 'INVALID_STATE';
  message: string;
}

export interface RateLimitError {
  operation: string;
  retryAfter: number; // seconds
  message: string;
}

export interface InvalidRequestError {
  operation: string;
  field?: string;
  message: string;
}

// ============================================================================
// Type Guards
// ============================================================================

export function isRoomCreateRequest(data: unknown): data is RoomCreateRequest {
  const d = data as RoomCreateRequest;
  return (
    typeof d?.userId === 'string' &&
    typeof d?.username === 'string' &&
    typeof d?.deviceId === 'string' &&
    ['ios', 'android', 'web'].includes(d?.deviceType)
  );
}

export function isRoomJoinRequest(data: unknown): data is RoomJoinRequest {
  const d = data as RoomJoinRequest;
  return (
    typeof d?.roomId === 'string' &&
    typeof d?.userId === 'string' &&
    typeof d?.username === 'string' &&
    typeof d?.deviceId === 'string' &&
    ['ios', 'android', 'web'].includes(d?.deviceType)
  );
}

export function isSyncPlayRequest(data: unknown): data is SyncPlayRequest {
  const d = data as SyncPlayRequest;
  return (
    typeof d?.roomId === 'string' &&
    typeof d?.userId === 'string' &&
    typeof d?.trackId === 'string' &&
    typeof d?.seekTime === 'number' &&
    d.seekTime >= 0
  );
}

export function isTimeSyncRequest(data: unknown): data is TimeSyncRequest {
  const d = data as TimeSyncRequest;
  return typeof d?.clientTimestamp === 'number';
}
