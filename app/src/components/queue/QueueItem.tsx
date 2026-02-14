// app/src/components/queue/QueueItem.tsx
// Individual queue item with unified styling across platforms

import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useTheme } from '../../hooks/useTheme';
import type { Track } from '@shared/types/entities';

const isWeb = Platform.OS === 'web';

interface QueueItemProps {
  track: Track & { queueId?: string; addedByUsername?: string };
  index: number;
  isCurrentTrack: boolean;
  isActive: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDelete: boolean;
  onDelete: (trackId: string, queueId: string) => void;
  onPress: (track: Track, index: number) => void;
  onMoveUp?: (index: number) => void;
  onMoveDown?: (index: number) => void;
  drag: () => void;
}

const formatDuration = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

export const QueueItem: React.FC<QueueItemProps> = React.memo(({
  track,
  index,
  isCurrentTrack,
  isActive,
  canMoveUp,
  canMoveDown,
  canDelete,
  onDelete,
  onPress,
  onMoveUp,
  onMoveDown,
  drag,
}) => {
  const theme = useTheme();

  const containerStyle = [
    styles.container,
    { backgroundColor: theme.colors.surface },
    isCurrentTrack && {
      borderLeftWidth: 3,
      borderLeftColor: theme.colors.primary,
      backgroundColor: theme.colors.background,
    },
    isActive && {
      opacity: 0.7,
      transform: [{ scale: 1.02 }],
      elevation: 8,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
    },
  ];

  const itemContent = (
    <TouchableOpacity
      style={containerStyle}
      onPress={() => onPress(track, index)}
      activeOpacity={0.7}
    >
      {/* Reorder controls */}
      <View style={styles.reorderControls}>
        {isWeb ? (
          // Web: up/down buttons
          <>
            <TouchableOpacity
              onPress={() => canMoveUp && onMoveUp?.(index)}
              disabled={!canMoveUp}
              activeOpacity={0.6}
              style={styles.reorderBtn}
            >
              <Text style={{ fontSize: 12, color: canMoveUp ? theme.colors.textSecondary : theme.colors.border }}>▲</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => canMoveDown && onMoveDown?.(index)}
              disabled={!canMoveDown}
              activeOpacity={0.6}
              style={styles.reorderBtn}
            >
              <Text style={{ fontSize: 12, color: canMoveDown ? theme.colors.textSecondary : theme.colors.border }}>▼</Text>
            </TouchableOpacity>
          </>
        ) : (
          // Native: drag handle
          <TouchableOpacity
            onLongPress={drag}
            delayLongPress={100}
            activeOpacity={0.6}
            style={styles.reorderBtn}
          >
            <Text style={[styles.dragIcon, { color: theme.colors.textSecondary }]}>≡</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Cover art */}
      {track.coverUrl ? (
        <Image
          source={{ uri: track.coverUrl }}
          style={[styles.cover, { borderRadius: theme.borderRadius.sm }]}
        />
      ) : (
        <View style={[styles.cover, styles.placeholderCover, { borderRadius: theme.borderRadius.sm, backgroundColor: theme.colors.border }]}>
          <Text style={[styles.placeholderIcon, { color: theme.colors.textSecondary }]}>♪</Text>
        </View>
      )}

      {/* Track info */}
      <View style={styles.info}>
        <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
          {track.title}
        </Text>
        <Text style={[styles.artist, { color: theme.colors.textSecondary }]} numberOfLines={1}>
          {track.artist}
        </Text>
      </View>

      {/* Duration */}
      <Text style={[styles.duration, { color: theme.colors.textSecondary }]}>
        {formatDuration(track.duration)}
      </Text>

      {/* Delete button — always visible, unified style */}
      {canDelete && (
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => onDelete(track.trackId, track.queueId || track.trackId)}
          activeOpacity={0.6}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={[styles.deleteBtnText, { color: theme.colors.textSecondary }]}>✕</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  // Native: also wrap with Swipeable for swipe-to-delete
  if (!isWeb && canDelete) {
    const renderRightActions = () => (
      <TouchableOpacity
        style={[styles.swipeDelete, { backgroundColor: theme.colors.error }]}
        onPress={() => onDelete(track.trackId, track.queueId || track.trackId)}
        activeOpacity={0.8}
      >
        <Text style={styles.swipeDeleteText}>删除</Text>
      </TouchableOpacity>
    );

    return (
      <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
        {itemContent}
      </Swipeable>
    );
  }

  return itemContent;
});

QueueItem.displayName = 'QueueItem';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  reorderControls: {
    width: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  reorderBtn: {
    paddingVertical: 4,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  dragIcon: {
    fontSize: 20,
    fontWeight: '600',
  },
  cover: {
    width: 40,
    height: 40,
    marginRight: 12,
  },
  placeholderCover: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderIcon: {
    fontSize: 20,
  },
  info: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  artist: {
    fontSize: 12,
  },
  duration: {
    fontSize: 12,
    marginLeft: 8,
  },
  deleteBtn: {
    marginLeft: 8,
    padding: 6,
  },
  deleteBtnText: {
    fontSize: 14,
  },
  swipeDelete: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  swipeDeleteText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
