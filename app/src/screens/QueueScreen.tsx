// app/src/screens/QueueScreen.tsx
// Queue management screen — full-page queue view

import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { useTheme } from '../hooks/useTheme';
import { useRoomStore, useConnectionStore } from '../stores';
import { queueService } from '../services/queue/QueueService';
import { preferencesStorage } from '../services/storage/PreferencesStorage';
import { musicApi } from '../services/api/MusicApi';
import { usePlayer } from '../hooks/usePlayer';
import { toast } from '../components/common/Toast';
import { QueueItem } from '../components/queue/QueueItem';
import { EmptyQueueState } from '../components/queue/EmptyQueueState';
import type { Track } from '@shared/types/entities';

const isWeb = Platform.OS === 'web';

export default function QueueScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const theme = useTheme();
  const roomStore = useRoomStore();
  const connectionStore = useConnectionStore();
  const [deviceId, setDeviceId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { play } = usePlayer();

  const playlist = roomStore.room?.playlist || [];
  const currentTrackIndex = roomStore.room?.currentTrackIndex ?? -1;
  const loopMode = roomStore.room?.loopMode || 'none';
  const isConnected = connectionStore.isConnected;
  const roomId = roomStore.room?.roomId;

  useEffect(() => {
    preferencesStorage.getDeviceId().then(setDeviceId);
  }, []);

  // Reorderable range
  const firstReorderableIndex = currentTrackIndex + 1;
  const lastReorderableIndex = playlist.length - 1;

  const handleRemove = useCallback(async (trackId: string, queueId: string) => {
    if (!isConnected || !roomId) return;
    setIsLoading(true);
    try {
      const result = await queueService.remove({ roomId, userId: deviceId, trackId, queueId });
      if (!result.success) toast.error(result.error || '移除失败');
    } finally {
      setIsLoading(false);
    }
  }, [roomId, deviceId, isConnected]);

  const handleReorder = useCallback(async (fromIndex: number, toIndex: number) => {
    if (!isConnected || !roomId) return;
    setIsLoading(true);
    try {
      const result = await queueService.reorder({ roomId, userId: deviceId, fromIndex, toIndex });
      if (!result.success) toast.error(result.error || '调整顺序失败');
    } finally {
      setIsLoading(false);
    }
  }, [roomId, deviceId, isConnected]);

  const handleTrackPress = useCallback(async (track: Track, index: number) => {
    if (!isConnected || !roomId) return;
    if (index === currentTrackIndex) return;
    setIsLoading(true);
    try {
      const result = await queueService.jump({ roomId, userId: deviceId, targetIndex: index });
      if (result.success && result.currentTrackIndex !== undefined && result.currentTrackIndex >= 0 && result.playlist) {
        const targetTrack = result.playlist[result.currentTrackIndex];
        if (targetTrack) {
          const audioResponse = await musicApi.getAudioUrl(targetTrack.trackId, { quality: 'exhigh' });
          if (audioResponse.success && audioResponse.data?.audioUrl) {
            await play(targetTrack, audioResponse.data.audioUrl);
          }
        }
      } else if (!result.success) {
        toast.error(result.error || '跳转失败');
      }
    } finally {
      setIsLoading(false);
    }
  }, [roomId, deviceId, isConnected, currentTrackIndex, play]);

  const handleLoopModeToggle = useCallback(async () => {
    if (!isConnected || !roomId) return;
    const newMode = loopMode === 'none' ? 'queue' : 'none';
    const result = await queueService.setLoopMode({ roomId, userId: deviceId, loopMode: newMode });
    if (!result.success) toast.error(result.error || '设置失败');
  }, [roomId, deviceId, isConnected, loopMode]);

  const handleAddSong = useCallback(() => {
    navigation.navigate('Search');
  }, [navigation]);

  const handleMoveUp = useCallback((index: number) => {
    if (index > firstReorderableIndex) {
      handleReorder(index, index - 1);
    }
  }, [firstReorderableIndex, handleReorder]);

  const handleMoveDown = useCallback((index: number) => {
    if (index >= firstReorderableIndex && index < lastReorderableIndex) {
      handleReorder(index, index + 1);
    }
  }, [firstReorderableIndex, lastReorderableIndex, handleReorder]);

  const renderDraggableItem = ({ item, drag, isActive, getIndex }: RenderItemParams<Track>) => {
    const index = getIndex() ?? -1;
    const isCurrent = index === currentTrackIndex;
    const canReorder = index > currentTrackIndex;
    return (
      <QueueItem
        track={item}
        index={index}
        isCurrentTrack={isCurrent}
        isActive={isActive}
        canMoveUp={canReorder && index > firstReorderableIndex}
        canMoveDown={canReorder && index < lastReorderableIndex}
        canDelete={!isCurrent}
        onDelete={handleRemove}
        onPress={handleTrackPress}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        drag={canReorder ? drag : () => {}}
      />
    );
  };

  const renderFlatItem = ({ item, index }: { item: Track; index: number }) => {
    const isCurrent = index === currentTrackIndex;
    const canReorder = index > currentTrackIndex;
    return (
      <QueueItem
        track={item}
        index={index}
        isCurrentTrack={isCurrent}
        isActive={false}
        canMoveUp={canReorder && index > firstReorderableIndex}
        canMoveDown={canReorder && index < lastReorderableIndex}
        canDelete={!isCurrent}
        onDelete={handleRemove}
        onPress={handleTrackPress}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        drag={() => {}}
      />
    );
  };

  const renderList = () => {
    if (playlist.length === 0) {
      return <EmptyQueueState onAddSong={handleAddSong} />;
    }

    if (isWeb) {
      return (
        <FlatList
          data={playlist}
          renderItem={renderFlatItem}
          keyExtractor={(item) => (item as any).queueId || item.trackId}
          contentContainerStyle={styles.listContent}
        />
      );
    }

    return (
      <DraggableFlatList
        data={playlist}
        renderItem={renderDraggableItem}
        keyExtractor={(item) => (item as any).queueId || item.trackId}
        onDragEnd={({ from, to }) => {
          if (from !== to) handleReorder(from, to);
        }}
        activationDistance={15}
        contentContainerStyle={styles.listContent}
      />
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.backText, { color: theme.colors.text }]}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>播放队列</Text>
          <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]}>
            {playlist.length} 首歌曲
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.loopButton, {
            backgroundColor: loopMode === 'queue' ? theme.colors.primary + '20' : theme.colors.surface,
          }]}
          onPress={handleLoopModeToggle}
          disabled={!isConnected}
          activeOpacity={0.7}
        >
          <Text style={[styles.loopText, {
            color: loopMode === 'queue' ? theme.colors.primary : theme.colors.textSecondary,
          }]}>
            {loopMode === 'queue' ? '循环' : '顺序'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <View style={styles.listContainer}>
        {renderList()}

        {!isConnected && (
          <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
            <Text style={[styles.overlayText, { color: theme.colors.text }]}>连接中...</Text>
          </View>
        )}
        {isLoading && (
          <View style={[styles.overlay, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
          </View>
        )}
      </View>

      {/* Add song FAB */}
      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        onPress={handleAddSong}
        activeOpacity={0.8}
        disabled={!isConnected}
      >
        <Text style={[styles.fabText, { color: theme.colors.background }]}>+ 添加歌曲</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backText: {
    fontSize: 28,
    lineHeight: 40,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  loopButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  loopText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
    position: 'relative',
  },
  listContent: {
    paddingBottom: 80,
  },
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    fontSize: 16,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 28,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  fabText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
