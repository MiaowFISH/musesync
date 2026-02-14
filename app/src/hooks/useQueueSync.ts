// app/src/hooks/useQueueSync.ts
// Hook managing queue event listeners, auto-advance, and toast notifications

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRoomStore } from '../stores';
import { queueService } from '../services/queue/QueueService';
import { socketManager } from '../services/sync/SocketManager';
import { audioService } from '../services/audio/AudioService';
import { musicApi } from '../services/api/MusicApi';
import { toast } from '../components/common/Toast';
import type { Track } from '@shared/types/entities';
import type { QueueUpdatedEvent } from '@shared/types/socket-events';

interface UseQueueSyncParams {
  roomId: string | undefined;
  userId: string;
  isConnected: boolean;
  play: (track: Track, audioUrl: string) => Promise<void>;
}

interface UseQueueSyncResult {
  // Queue state
  playlist: Track[];
  currentTrackIndex: number;
  loopMode: 'none' | 'queue';
  isQueueLoading: boolean;

  // Queue operations (wrapped with loading state)
  handleRemove: (trackId: string, queueId: string) => Promise<void>;
  handleReorder: (fromIndex: number, toIndex: number) => Promise<void>;
  handleTrackPress: (track: Track, index: number) => Promise<void>;
  handleLoopModeToggle: () => Promise<void>;
  handleAddSong: () => void;
}

export function useQueueSync(params: UseQueueSyncParams): UseQueueSyncResult {
  const { roomId, userId, isConnected, play } = params;
  const roomStore = useRoomStore();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const [isQueueLoading, setIsQueueLoading] = useState(false);
  const advanceDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAdvancedRef = useRef(false);

  // Extract queue state from room store
  const playlist = roomStore.room?.playlist || [];
  const currentTrackIndex = roomStore.room?.currentTrackIndex ?? -1;
  const loopMode = roomStore.room?.loopMode || 'none';

  /**
   * Fetch audio URL and play a track (used by the advance initiator)
   */
  const fetchAndPlay = useCallback(async (track: Track) => {
    try {
      console.log('[useQueueSync] Fetching audio for:', track.title);
      const audioResponse = await musicApi.getAudioUrl(track.trackId, { quality: 'exhigh' });
      if (audioResponse.success && audioResponse.data?.audioUrl) {
        await play(track, audioResponse.data.audioUrl);
      } else {
        console.error('[useQueueSync] Failed to get audio URL for:', track.title);
        toast.error('无法获取音频链接');
      }
    } catch (error) {
      console.error('[useQueueSync] fetchAndPlay error:', error);
      toast.error('播放失败');
    }
  }, [play]);

  /**
   * Toast notifications for queue:updated events from other users.
   * The actual state update is handled by RoomProvider's queue:updated listener.
   */
  useEffect(() => {
    if (!roomId) return;

    const socket = socketManager.getSocket();
    if (!socket) return;

    const handleQueueUpdated = (event: QueueUpdatedEvent) => {
      if (event.roomId !== roomId) return;

      // Show toast for OTHER users' operations (not own)
      if (event.operatorName && event.operatorName !== userId) {
        switch (event.operation) {
          case 'add':
            if (event.trackTitle) {
              toast.info(`${event.operatorName} 添加了 ${event.trackTitle}`);
            }
            break;
          case 'remove':
            toast.info(`${event.operatorName} 移除了一首歌曲`);
            break;
          case 'reorder':
            toast.info(`${event.operatorName} 调整了播放顺序`);
            break;
        }
      }
    };

    socket.on('queue:updated', handleQueueUpdated);
    console.log('[useQueueSync] Registered queue:updated toast listener for room:', roomId);

    return () => {
      socket.off('queue:updated', handleQueueUpdated);
    };
  }, [roomId, userId]);

  /**
   * Auto-advance logic: listen for track end and request next track from server
   */
  useEffect(() => {
    if (!roomId || !isConnected) return;

    const handleTrackEnd = async () => {
      console.log('[useQueueSync] Track ended, checking for auto-advance');

      // Debounce to prevent duplicate advance calls
      if (hasAdvancedRef.current) {
        console.log('[useQueueSync] Already advanced, skipping');
        return;
      }

      hasAdvancedRef.current = true;

      // Clear any existing debounce timer
      if (advanceDebounceRef.current) {
        clearTimeout(advanceDebounceRef.current);
      }

      // Reset the flag after 500ms
      advanceDebounceRef.current = setTimeout(() => {
        hasAdvancedRef.current = false;
      }, 500);

      // Request advance from server
      const result = await queueService.advance({
        roomId,
        userId,
        direction: 'next',
      });

      if (result.success) {
        console.log('[useQueueSync] Auto-advance successful, index:', result.currentTrackIndex);
        // Operator plays the new track themselves (sync:state skips own updates)
        if (result.currentTrackIndex !== undefined && result.currentTrackIndex >= 0 && result.playlist) {
          const nextTrack = result.playlist[result.currentTrackIndex];
          if (nextTrack) {
            await fetchAndPlay(nextTrack);
          }
        }
      } else {
        // Check if queue finished (currentTrackIndex === -1)
        if (result.currentTrackIndex === -1) {
          console.log('[useQueueSync] Queue finished');
          toast.info('播放队列已结束');
        } else {
          console.error('[useQueueSync] Auto-advance failed:', result.error);
        }
      }
    };

    audioService.onEnd(handleTrackEnd);

    return () => {
      // Clear debounce timer on unmount
      if (advanceDebounceRef.current) {
        clearTimeout(advanceDebounceRef.current);
      }
    };
  }, [roomId, userId, isConnected]);

  /**
   * Handle remove track
   */
  const handleRemove = useCallback(async (trackId: string, queueId: string) => {
    if (!isConnected) {
      toast.error('未连接到服务器');
      return;
    }

    if (!roomId) {
      toast.error('未加入房间');
      return;
    }

    setIsQueueLoading(true);

    try {
      const result = await queueService.remove({
        roomId,
        userId,
        trackId,
        queueId,
      });

      if (!result.success) {
        toast.error(result.error || '移除失败');
      }
    } catch (error) {
      console.error('[useQueueSync] Remove error:', error);
      toast.error('移除失败');
    } finally {
      setIsQueueLoading(false);
    }
  }, [roomId, userId, isConnected]);

  /**
   * Handle reorder tracks
   */
  const handleReorder = useCallback(async (fromIndex: number, toIndex: number) => {
    if (!isConnected) {
      toast.error('未连接到服务器');
      return;
    }

    if (!roomId) {
      toast.error('未加入房间');
      return;
    }

    setIsQueueLoading(true);

    try {
      const result = await queueService.reorder({
        roomId,
        userId,
        fromIndex,
        toIndex,
      });

      if (!result.success) {
        toast.error(result.error || '调整顺序失败');
      }
    } catch (error) {
      console.error('[useQueueSync] Reorder error:', error);
      toast.error('调整顺序失败');
    } finally {
      setIsQueueLoading(false);
    }
  }, [roomId, userId, isConnected]);

  /**
   * Handle track press (jump to track)
   */
  const handleTrackPress = useCallback(async (track: Track, index: number) => {
    if (!isConnected) {
      toast.error('未连接到服务器');
      return;
    }

    if (!roomId) {
      toast.error('未加入房间');
      return;
    }

    // Calculate direction based on current index
    const currentIndex = roomStore.room?.currentTrackIndex ?? -1;
    if (index === currentIndex) {
      // Already playing this track
      return;
    }

    setIsQueueLoading(true);

    try {
      // Use advance to jump to the track
      const direction = index > currentIndex ? 'next' : 'previous';
      const steps = Math.abs(index - currentIndex);
      let lastResult: any = null;

      for (let i = 0; i < steps; i++) {
        const result = await queueService.advance({
          roomId,
          userId,
          direction,
        });

        if (!result.success) {
          toast.error(result.error || '跳转失败');
          break;
        }
        lastResult = result;
      }

      // Operator plays the target track themselves
      if (lastResult?.success && lastResult.currentTrackIndex >= 0 && lastResult.playlist) {
        const targetTrack = lastResult.playlist[lastResult.currentTrackIndex];
        if (targetTrack) {
          await fetchAndPlay(targetTrack);
        }
      }
    } catch (error) {
      console.error('[useQueueSync] Track press error:', error);
      toast.error('跳转失败');
    } finally {
      setIsQueueLoading(false);
    }
  }, [roomId, userId, isConnected, roomStore.room?.currentTrackIndex, fetchAndPlay]);

  /**
   * Handle loop mode toggle
   */
  const handleLoopModeToggle = useCallback(async () => {
    if (!isConnected) {
      toast.error('未连接到服务器');
      return;
    }

    if (!roomId) {
      toast.error('未加入房间');
      return;
    }

    const newLoopMode = loopMode === 'none' ? 'queue' : 'none';

    setIsQueueLoading(true);

    try {
      const result = await queueService.setLoopMode({
        roomId,
        userId,
        loopMode: newLoopMode,
      });

      if (!result.success) {
        toast.error(result.error || '设置循环模式失败');
      }
    } catch (error) {
      console.error('[useQueueSync] Loop mode toggle error:', error);
      toast.error('设置循环模式失败');
    } finally {
      setIsQueueLoading(false);
    }
  }, [roomId, userId, isConnected, loopMode]);

  /**
   * Handle add song (navigate to search)
   */
  const handleAddSong = useCallback(() => {
    navigation.navigate('Search');
  }, [navigation]);

  return {
    playlist,
    currentTrackIndex,
    loopMode,
    isQueueLoading,
    handleRemove,
    handleReorder,
    handleTrackPress,
    handleLoopModeToggle,
    handleAddSong,
  };
}
