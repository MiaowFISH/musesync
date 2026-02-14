// app/src/components/queue/QueueBottomSheet.tsx
// Main queue bottom sheet with drag-drop list

import React, { useRef, useMemo, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, FlatList, Platform } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import DraggableFlatList, { RenderItemParams } from 'react-native-draggable-flatlist';
import { useTheme } from '../../hooks/useTheme';
import { QueueItem } from './QueueItem';
import { EmptyQueueState } from './EmptyQueueState';
import type { Track } from '@shared/types/entities';

const isWeb = Platform.OS === 'web';

interface QueueBottomSheetProps {
  playlist: Track[];
  currentTrackIndex: number;
  loopMode: 'none' | 'queue';
  isLoading: boolean;
  isConnected: boolean;
  onAddSong: () => void;
  onRemove: (trackId: string, queueId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onTrackPress: (track: Track, index: number) => void;
  onLoopModeToggle: () => void;
}

export const QueueBottomSheet: React.FC<QueueBottomSheetProps> = ({
  playlist,
  currentTrackIndex,
  loopMode,
  isLoading,
  isConnected,
  onAddSong,
  onRemove,
  onReorder,
  onTrackPress,
  onLoopModeToggle,
}) => {
  const theme = useTheme();
  const bottomSheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['12%', '50%', '90%'], []);
  const [isDragging, setIsDragging] = useState(false);

  // Reorderable range: only tracks after currentTrackIndex
  const firstReorderableIndex = currentTrackIndex + 1;
  const lastReorderableIndex = playlist.length - 1;

  const handleMoveUp = useCallback((index: number) => {
    if (index > firstReorderableIndex) {
      onReorder(index, index - 1);
    }
  }, [firstReorderableIndex, onReorder]);

  const handleMoveDown = useCallback((index: number) => {
    if (index < lastReorderableIndex) {
      onReorder(index, index + 1);
    }
  }, [lastReorderableIndex, onReorder]);

  const renderDraggableItem = ({ item, drag, isActive, getIndex }: RenderItemParams<Track>) => {
    const index = getIndex() ?? -1;
    const isCurrentTrack = index === currentTrackIndex;
    const canReorder = index > currentTrackIndex;
    return (
      <QueueItem
        track={item}
        index={index}
        isCurrentTrack={isCurrentTrack}
        isActive={isActive}
        isFirst={!canReorder || index === firstReorderableIndex}
        isLast={index === lastReorderableIndex}
        onDelete={onRemove}
        onPress={onTrackPress}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        drag={canReorder ? drag : () => {}}
      />
    );
  };

  const renderWebItem = ({ item, index }: { item: Track; index: number }) => {
    const isCurrentTrack = index === currentTrackIndex;
    const canReorder = index > currentTrackIndex;
    return (
      <QueueItem
        track={item}
        index={index}
        isCurrentTrack={isCurrentTrack}
        isActive={false}
        isFirst={!canReorder || index === firstReorderableIndex}
        isLast={index === lastReorderableIndex}
        onDelete={onRemove}
        onPress={onTrackPress}
        onMoveUp={handleMoveUp}
        onMoveDown={handleMoveDown}
        drag={() => {}}
      />
    );
  };

  const renderHeader = () => (
    <View style={[styles.header, { backgroundColor: theme.colors.surface, borderBottomColor: theme.colors.border }]}>
      <View style={styles.headerTop}>
        <View>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]}>播放队列</Text>
          <Text style={[styles.trackCount, { color: theme.colors.textSecondary }]}>
            {playlist.length} 首歌曲
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.loopButton, { backgroundColor: theme.colors.background }]}
            onPress={onLoopModeToggle}
            activeOpacity={0.7}
            disabled={!isConnected}
          >
            <Text style={[styles.loopText, { color: loopMode === 'queue' ? theme.colors.primary : theme.colors.textSecondary }]}>
              {loopMode === 'queue' ? '🔁 循环' : '➡️ 顺序'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
            onPress={onAddSong}
            activeOpacity={0.8}
            disabled={!isConnected}
          >
            <Text style={[styles.addButtonText, { color: theme.colors.background }]}>
              + 添加歌曲
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const renderListContent = () => {
    if (playlist.length === 0) {
      return <EmptyQueueState onAddSong={onAddSong} />;
    }

    if (isWeb) {
      return (
        <FlatList
          data={playlist}
          renderItem={renderWebItem}
          keyExtractor={(item, index) => (item as any).queueId || item.trackId || `track-${index}`}
          style={{ backgroundColor: theme.colors.background }}
        />
      );
    }

    return (
      <DraggableFlatList
        data={playlist}
        renderItem={renderDraggableItem}
        keyExtractor={(item, index) => (item as any).queueId || item.trackId || `track-${index}`}
        onDragBegin={() => setIsDragging(true)}
        onDragEnd={({ from, to }) => {
          setIsDragging(false);
          if (from !== to) {
            onReorder(from, to);
          }
        }}
        activationDistance={15}
        containerStyle={{ backgroundColor: theme.colors.background }}
      />
    );
  };

  return (
    <BottomSheet
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose={false}
      enableContentPanningGesture={!isDragging}
      enableHandlePanningGesture={!isDragging}
      backgroundStyle={{ backgroundColor: theme.colors.surface }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.border }}
    >
      <BottomSheetView style={styles.contentContainer}>
        {renderHeader()}

        <View style={styles.listContainer}>
          {renderListContent()}

          {/* Disconnection overlay */}
          {!isConnected && (
            <View style={[styles.overlay, { backgroundColor: 'rgba(0, 0, 0, 0.7)' }]}>
              <Text style={[styles.overlayText, { color: theme.colors.text }]}>
                连接中...
              </Text>
            </View>
          )}

          {/* Loading overlay */}
          {isLoading && (
            <View style={[styles.overlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}>
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          )}
        </View>
      </BottomSheetView>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  contentContainer: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  trackCount: {
    fontSize: 12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  loopButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  loopText: {
    fontSize: 12,
    fontWeight: '600',
  },
  addButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  addButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
    position: 'relative',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlayText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
