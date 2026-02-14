// backend/src/services/queue/QueueManager.ts
// Queue management business logic

import type { Track } from '@shared/types/entities';
import type { QueueOperationResponse } from '@shared/types/socket-events';
import { roomManager } from '../room/RoomManager';

/**
 * Queue Manager Service
 * Handles all queue-related business logic
 */
export class QueueManager {
  private readonly MAX_QUEUE_SIZE = 50; // Soft limit per research recommendation

  /**
   * Generate unique queue ID
   */
  private generateQueueId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /**
   * Add track to queue as "play next" (after current track)
   * Per user decision: "New songs insert as 'play next' (after currently playing track), not appended to end"
   */
  addTrack(roomId: string, track: Track, userId: string, username: string): QueueOperationResponse {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        return { success: false, error: 'Room not found' };
      }

      // Check soft limit
      if (room.playlist.length >= this.MAX_QUEUE_SIZE) {
        return { success: false, error: `Queue is full (max ${this.MAX_QUEUE_SIZE} songs)` };
      }

      // Check for duplicate
      const isDuplicate = room.playlist.some((t) => t.trackId === track.trackId);
      if (isDuplicate) {
        return { success: false, error: 'Track already in queue' };
      }

      // Create queue item with metadata
      const queueItem: Track = {
        ...track,
        addedBy: userId,
        addedAt: Date.now(),
      };

      // Insert as "play next" (after current track)
      const insertIndex = room.currentTrackIndex >= 0 ? room.currentTrackIndex + 1 : 0;
      const newPlaylist = [...room.playlist];
      newPlaylist.splice(insertIndex, 0, queueItem);

      // Update room playlist
      roomManager.updatePlaylist(roomId, newPlaylist, room.currentTrackIndex);

      console.log(`[QueueManager] Track added to room ${roomId} at index ${insertIndex} by ${username}`);

      return {
        success: true,
        playlist: newPlaylist,
        currentTrackIndex: room.currentTrackIndex,
      };
    } catch (error) {
      console.error('[QueueManager] Error adding track:', error);
      return { success: false, error: 'Failed to add track' };
    }
  }

  /**
   * Remove track from queue by trackId
   */
  removeTrack(roomId: string, trackId: string): QueueOperationResponse {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        return { success: false, error: 'Room not found' };
      }

      // Find track index
      const trackIndex = room.playlist.findIndex((t) => t.trackId === trackId);
      if (trackIndex === -1) {
        return { success: false, error: 'Track not found in queue' };
      }

      // Remove track
      const newPlaylist = room.playlist.filter((t) => t.trackId !== trackId);

      // Adjust currentTrackIndex if needed
      let newCurrentTrackIndex = room.currentTrackIndex;
      if (trackIndex < room.currentTrackIndex) {
        // Removed track was before current track, decrement index
        newCurrentTrackIndex = Math.max(0, room.currentTrackIndex - 1);
      } else if (trackIndex === room.currentTrackIndex) {
        // Removed the currently playing track, keep index (will point to next track)
        // If it was the last track, set to -1
        if (newPlaylist.length === 0) {
          newCurrentTrackIndex = -1;
        } else if (newCurrentTrackIndex >= newPlaylist.length) {
          newCurrentTrackIndex = newPlaylist.length - 1;
        }
      }

      // Update room playlist
      roomManager.updatePlaylist(roomId, newPlaylist, newCurrentTrackIndex);

      console.log(`[QueueManager] Track removed from room ${roomId} at index ${trackIndex}`);

      return {
        success: true,
        playlist: newPlaylist,
        currentTrackIndex: newCurrentTrackIndex,
      };
    } catch (error) {
      console.error('[QueueManager] Error removing track:', error);
      return { success: false, error: 'Failed to remove track' };
    }
  }

  /**
   * Reorder track in queue (move from fromIndex to toIndex)
   * Only reorder within the upcoming portion (indices > currentTrackIndex)
   */
  reorderTrack(roomId: string, fromIndex: number, toIndex: number): QueueOperationResponse {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        return { success: false, error: 'Room not found' };
      }

      // Validate indices
      if (fromIndex < 0 || fromIndex >= room.playlist.length) {
        return { success: false, error: 'Invalid fromIndex' };
      }
      if (toIndex < 0 || toIndex >= room.playlist.length) {
        return { success: false, error: 'Invalid toIndex' };
      }
      if (fromIndex === toIndex) {
        return { success: true, playlist: room.playlist, currentTrackIndex: room.currentTrackIndex };
      }

      // Prevent reordering the currently playing track or past tracks
      if (fromIndex <= room.currentTrackIndex || toIndex <= room.currentTrackIndex) {
        return { success: false, error: 'Cannot reorder current or past tracks' };
      }

      // Reorder playlist
      const newPlaylist = [...room.playlist];
      const [movedTrack] = newPlaylist.splice(fromIndex, 1);
      newPlaylist.splice(toIndex, 0, movedTrack);

      // Update room playlist
      roomManager.updatePlaylist(roomId, newPlaylist, room.currentTrackIndex);

      console.log(`[QueueManager] Track reordered in room ${roomId} from ${fromIndex} to ${toIndex}`);

      return {
        success: true,
        playlist: newPlaylist,
        currentTrackIndex: room.currentTrackIndex,
      };
    } catch (error) {
      console.error('[QueueManager] Error reordering track:', error);
      return { success: false, error: 'Failed to reorder track' };
    }
  }

  /**
   * Advance to next/previous track
   * For 'next': increment currentTrackIndex. If at end and loopMode='queue', wrap to 0.
   * If at end and loopMode='none', return success with currentTrackIndex=-1 (queue finished).
   * For 'previous': decrement currentTrackIndex (min 0).
   */
  advanceTrack(roomId: string, direction: 'next' | 'previous'): QueueOperationResponse {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        return { success: false, error: 'Room not found' };
      }

      let newCurrentTrackIndex = room.currentTrackIndex;

      if (direction === 'next') {
        if (room.currentTrackIndex < room.playlist.length - 1) {
          // Move to next track
          newCurrentTrackIndex = room.currentTrackIndex + 1;
        } else {
          // At end of queue
          if (room.loopMode === 'queue') {
            // Loop back to start
            newCurrentTrackIndex = 0;
          } else {
            // Queue finished
            newCurrentTrackIndex = -1;
          }
        }
      } else {
        // Previous
        if (room.currentTrackIndex > 0) {
          newCurrentTrackIndex = room.currentTrackIndex - 1;
        } else {
          // Already at first track, stay at 0
          newCurrentTrackIndex = 0;
        }
      }

      // Update room playlist
      roomManager.updatePlaylist(roomId, room.playlist, newCurrentTrackIndex);

      console.log(`[QueueManager] Advanced ${direction} in room ${roomId} to index ${newCurrentTrackIndex}`);

      return {
        success: true,
        playlist: room.playlist,
        currentTrackIndex: newCurrentTrackIndex,
      };
    } catch (error) {
      console.error('[QueueManager] Error advancing track:', error);
      return { success: false, error: 'Failed to advance track' };
    }
  }

  /**
   * Jump directly to a specific track index
   */
  jumpToTrack(roomId: string, targetIndex: number): QueueOperationResponse {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        return { success: false, error: 'Room not found' };
      }

      if (targetIndex < 0 || targetIndex >= room.playlist.length) {
        return { success: false, error: 'Invalid target index' };
      }

      if (targetIndex === room.currentTrackIndex) {
        return { success: true, playlist: room.playlist, currentTrackIndex: room.currentTrackIndex };
      }

      // Update room playlist with new index
      roomManager.updatePlaylist(roomId, room.playlist, targetIndex);

      console.log(`[QueueManager] Jumped to index ${targetIndex} in room ${roomId}`);

      return {
        success: true,
        playlist: room.playlist,
        currentTrackIndex: targetIndex,
      };
    } catch (error) {
      console.error('[QueueManager] Error jumping to track:', error);
      return { success: false, error: 'Failed to jump to track' };
    }
  }

  /**
   * Set loop mode for room
   */
  setLoopMode(roomId: string, loopMode: 'none' | 'queue'): QueueOperationResponse {
    try {
      const room = roomManager.getRoom(roomId);
      if (!room) {
        return { success: false, error: 'Room not found' };
      }

      // Update room loop mode
      room.loopMode = loopMode;
      roomManager.updateRoom(roomId, room);

      console.log(`[QueueManager] Loop mode set to ${loopMode} in room ${roomId}`);

      return {
        success: true,
        playlist: room.playlist,
        currentTrackIndex: room.currentTrackIndex,
        loopMode,
      };
    } catch (error) {
      console.error('[QueueManager] Error setting loop mode:', error);
      return { success: false, error: 'Failed to set loop mode' };
    }
  }
}

// Singleton instance
export const queueManager = new QueueManager();
