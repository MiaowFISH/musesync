// app/src/components/queue/QueueItem.tsx
// Individual queue item with swipe-to-delete and drag handle

import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Swipeable } from 'react-native-gesture-handler';
import { useTheme } from '../../hooks/useTheme';
import type { Track } from '@shared/types/entities';

interface QueueItemProps {
  track: Track & { queueId?: string; addedByUsername?: string };
  index: number;
  isCurrentTrack: boolean;
  isActive: boolean;
  onDelete: (trackId: string, queueId: string) => void;
  onPress: (track: Track, index: number) => void;
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
  onDelete,
  onPress,
  drag,
}) => {
  const theme = useTheme();

  const renderRightActions = () => (
    <TouchableOpacity
      style={[styles.deleteButton, { backgroundColor: theme.colors.error }]}
      onPress={() => onDelete(track.trackId, track.queueId || track.trackId)}
      activeOpacity={0.8}
    >
      <Text style={[styles.deleteText, { color: '#FFFFFF' }]}>删除</Text>
    </TouchableOpacity>
  );

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

  return (
    <Swipeable renderRightActions={renderRightActions} overshootRight={false}>
      <TouchableOpacity
        style={containerStyle}
        onPress={() => onPress(track, index)}
        activeOpacity={0.7}
      >
        <TouchableOpacity
          style={styles.dragHandle}
          onLongPress={drag}
          delayLongPress={100}
          activeOpacity={0.6}
        >
          <Text style={[styles.dragIcon, { color: theme.colors.textSecondary }]}>≡</Text>
        </TouchableOpacity>

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

        <View style={styles.info}>
          <Text
            style={[styles.title, { color: theme.colors.text }]}
            numberOfLines={1}
          >
            {track.title}
          </Text>
          <Text
            style={[styles.artist, { color: theme.colors.textSecondary }]}
            numberOfLines={1}
          >
            {track.artist}
          </Text>
        </View>

        <View style={styles.metadata}>
          <Text style={[styles.duration, { color: theme.colors.textSecondary }]}>
            {formatDuration(track.duration)}
          </Text>
          {track.addedByUsername && (
            <Text style={[styles.addedBy, { color: theme.colors.textSecondary }]}>
              {track.addedByUsername}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
});

QueueItem.displayName = 'QueueItem';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  dragHandle: {
    paddingHorizontal: 8,
    paddingVertical: 12,
    marginRight: 4,
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
  metadata: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },
  duration: {
    fontSize: 12,
    marginBottom: 2,
  },
  addedBy: {
    fontSize: 10,
  },
  deleteButton: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
