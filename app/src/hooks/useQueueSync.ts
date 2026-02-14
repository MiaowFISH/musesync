// app/src/hooks/useQueueSync.ts
// Hook managing queue event listeners, auto-advance, and toast notifications

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useRoomStore } from '../stores';
import { queueService } from '../services/queue/QueueService';
import { socketManager } from '../services/sync/SocketManager';
import { audioService } from '../services/audio/AudioService';
import { toast } from '../components/common/Toast';
import type { Track } from '@shared/types/entities';
import type { QueueUpdatedEvent } from '@shared/types/socket-events';

interface UseQueueSyncParams {
  roomId: string | undefined;
  userId: string;
  isConnected: boolean;
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
  const { roomId, userId, isConnected } = params;
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
   * Socket listener for queue:updated events
   */
  useEffect(() => {
    if (!roomId) return;

    const socket = socketManager.getSocket();
    if (!socket) return;

    const handleQueueUpdated = (event: QueueUpdatedEvent) => {
      console.log('[useQueueSync] queue:updated received:', event.operation);

      // Update playlist
      roomStore.updatePlaylist(event.playlist);

      // Update current track index
      roomStore.updateCurrentTrackIndex(event.currentTrackIndex);

      // Update loop mode if present
      if (event.loopMode !== undefined) {
        roomStore.updateLoopMode(event.loopMode);
      }

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

      // Handle auto-advance: if operation is 'advance' and there's a new current track, trigger playback
      if (event.operation === 'advance' && event.currentTrack && event.currentTrackIndex >= 0) {
        console.log('[useQueueSync] Auto-advance: playing next track:', event.currentTrack.title);
        // The play function will be called from the parent component (PlayerScreen)
        // We just need to ensure the state is updated, which is already done above
      }
    };

    socket.on('queue:updated', handleQueueUpdated);

    console.log('[useQueueSync] Registered queue:updated listener for room:', roomId);

    return () => {
      socket.off('queue:updated', handleQueueUpdated);
      console.log('[useQueueSync] Unregistered queue:updated listener');
    };
  }, [roomId, userId, roomStore]);

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
        console.log('[useQueueSync] Auto-advance successful');
        // The queue:updated event will trigger playback via the listener above
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
      // We'll need to call advance multiple times to reach the target index
      // For now, we'll use a simple approach: advance in the correct direction
      const direction = index > currentIndex ? 'next' : 'previous';
      const steps = Math.abs(index - currentIndex);

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
      }
    } catch (error) {
      console.error('[useQueueSync] Track press error:', error);
      toast.error('跳转失败');
    } finally {
      setIsQueueLoading(false);
    }
  }, [roomId, userId, isConnected, roomStore.room?.currentTrackIndex]);

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
