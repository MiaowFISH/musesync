// app/src/hooks/useAppLifecycle.ts
// React hook that wires AppLifecycleManager to component tree and applies reconciliation results

import { useEffect } from 'react';
import { appLifecycleManager } from '../services/lifecycle/AppLifecycleManager';
import { useRoomStore, usePlayerStore } from '../stores';
import { toast } from '../components/common/Toast';
import { audioService } from '../services/audio/AudioService';
import { musicApi } from '../services/api/MusicApi';

/**
 * Hook to manage app lifecycle and state reconciliation
 * Wires AppLifecycleManager to React component tree
 */
export function useAppLifecycle() {
  const roomStore = useRoomStore();
  const playerStore = usePlayerStore();

  const roomId = roomStore.room?.roomId;
  const userId = roomStore.room?.members[0]?.userId; // Use first member as userId for now

  // Update room context when it changes
  useEffect(() => {
    appLifecycleManager.setRoomContext(roomId || null, userId || null);
  }, [roomId, userId]);

  // Start/stop lifecycle manager
  useEffect(() => {
    appLifecycleManager.start();
    return () => {
      appLifecycleManager.stop();
    };
  }, []);

  // Subscribe to reconciliation results
  useEffect(() => {
    const unsubscribe = appLifecycleManager.onReconciliation(async (result) => {
      console.log('[useAppLifecycle] Reconciliation result received:', result);

      // Skip if reconciliation was not applied
      if (!result.applied || result.skipped) {
        console.log('[useAppLifecycle] Reconciliation skipped:', result.reason);
        return;
      }

      // Apply state changes
      if (result.newState && result.changes) {
        const { room, syncState, playlist, currentTrackIndex, loopMode } = result.newState;
        const { trackChanged, positionDrift, playStateChanged, queueChanged } = result.changes;

        // Update room store with new state
        roomStore.setRoom(room);
        roomStore.updateSyncState(syncState);
        roomStore.updateQueueState({ playlist, currentTrackIndex, loopMode });

        // Handle track change
        if (trackChanged && currentTrackIndex >= 0 && currentTrackIndex < playlist.length) {
          const newTrack = playlist[currentTrackIndex];
          console.log('[useAppLifecycle] Track changed, fetching audio for:', newTrack.title);

          try {
            // Fetch audio URL for new track
            const audioResponse = await musicApi.getAudioUrl(newTrack.trackId, { quality: 'exhigh' });
            if (audioResponse.success && audioResponse.data?.audioUrl) {
              // Play new track
              await audioService.play(newTrack, audioResponse.data.audioUrl);
              playerStore.setCurrentTrack(newTrack);
              playerStore.setPlaying(syncState.status === 'playing');
              playerStore.setPosition(syncState.seekTime);
              playerStore.setDuration(newTrack.duration);

              // Seek to correct position if needed
              if (syncState.seekTime > 0) {
                audioService.seek(syncState.seekTime);
              }
            } else {
              console.error('[useAppLifecycle] Failed to get audio URL for new track');
              toast.error('无法加载新曲目');
            }
          } catch (error) {
            console.error('[useAppLifecycle] Error fetching audio for new track:', error);
            toast.error('加载曲目失败');
          }
        } else if (positionDrift) {
          // Handle position drift (seek without track change)
          console.log('[useAppLifecycle] Position drift detected, seeking to:', syncState.seekTime);
          audioService.seek(syncState.seekTime);
          playerStore.setPosition(syncState.seekTime);
        }

        // Handle play state change
        if (playStateChanged) {
          console.log('[useAppLifecycle] Play state changed to:', syncState.status);
          if (syncState.status === 'playing') {
            await audioService.resume();
            playerStore.setPlaying(true);
          } else {
            audioService.pause();
            playerStore.setPlaying(false);
          }
        }

        // Show toast notification if provided
        if (result.toastMessage) {
          toast.info(result.toastMessage);
        }
      }
    });

    return unsubscribe;
  }, [roomStore, playerStore]);

  return {
    isInBackground: appLifecycleManager.isBackgrounded(),
  };
}
