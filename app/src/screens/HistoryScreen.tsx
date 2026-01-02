// app/src/screens/HistoryScreen.tsx
// Playback history screen

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../hooks/useTheme';
import { historyStorage, type HistoryTrack } from '../services/storage/HistoryStorage';
import { toast } from '../components/common/Toast';

export const HistoryScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const theme = useTheme();
  const [history, setHistory] = useState<HistoryTrack[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({ totalTracks: 0 });

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const [historyData, statsData] = await Promise.all([
        historyStorage.getHistory(),
        historyStorage.getStats(),
      ]);
      setHistory(historyData);
      setStats(statsData);
    } catch (error) {
      console.error('[HistoryScreen] Load history error:', error);
      toast.error('Failed to load history');
    }
  };

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  }, []);

  const handleTrackPress = (track: HistoryTrack) => {
    navigation.navigate('Player', {
      trackId: track.trackId,
      track,
    });
  };

  const handleClearHistory = async () => {
    try {
      await historyStorage.clearHistory();
      setHistory([]);
      setStats({ totalTracks: 0 });
      toast.success('History cleared');
    } catch (error) {
      console.error('[HistoryScreen] Clear history error:', error);
      toast.error('Failed to clear history');
    }
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    // Less than 1 minute
    if (diff < 60000) {
      return '刚刚';
    }
    
    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}分钟前`;
    }
    
    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}小时前`;
    }
    
    // Less than 7 days
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `${days}天前`;
    }
    
    // Format as date
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const renderItem = ({ item }: { item: HistoryTrack }) => (
    <TouchableOpacity
      style={[styles.item, { backgroundColor: theme.colors.surface }]}
      onPress={() => handleTrackPress(item)}
      activeOpacity={0.7}
    >
      {item.albumArt ? (
        <Image source={{ uri: item.albumArt }} style={styles.albumArt} />
      ) : (
        <View style={[styles.albumArt, styles.placeholderArt, { backgroundColor: theme.colors.border }]}>
          <Text style={[styles.placeholderIcon, { color: theme.colors.textSecondary }]}>♪</Text>
        </View>
      )}

      <View style={styles.info}>
        <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.artist, { color: theme.colors.textSecondary }]} numberOfLines={1}>
          {item.artist}
        </Text>
        <Text style={[styles.time, { color: theme.colors.textSecondary }]}>
          {formatDate(item.playedAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={[styles.emptyIcon, { color: theme.colors.textSecondary }]}>🎵</Text>
      <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
        暂无播放历史
      </Text>
      <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}>
        播放音乐后会自动记录到这里
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.backButtonText, { color: theme.colors.text }]}>←</Text>
        </TouchableOpacity>
        
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
          播放历史
        </Text>

        {history.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClearHistory}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.clearButtonText, { color: theme.colors.error || '#F44336' }]}>
              清空
            </Text>
          </TouchableOpacity>
        )}
        {history.length === 0 && <View style={styles.headerRight} />}
      </View>

      {/* Stats */}
      {stats.totalTracks > 0 && (
        <View style={styles.statsContainer}>
          <Text style={[styles.statsText, { color: theme.colors.textSecondary }]}>
            共 {stats.totalTracks} 首歌曲
          </Text>
        </View>
      )}

      {/* History List */}
      <FlatList
        data={history}
        renderItem={renderItem}
        keyExtractor={(item) => `${item.trackId}-${item.playedAt}`}
        ListEmptyComponent={renderEmpty}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={theme.colors.primary}
          />
        }
        contentContainerStyle={history.length === 0 ? styles.emptyList : styles.list}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    height: 60,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 28,
    lineHeight: 44,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  clearButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerRight: {
    width: 44,
  },
  statsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  statsText: {
    fontSize: 12,
  },
  list: {
    paddingBottom: 16,
  },
  emptyList: {
    flex: 1,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
  },
  albumArt: {
    width: 56,
    height: 56,
    borderRadius: 4,
    marginRight: 12,
  },
  placeholderArt: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 24,
  },
  info: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  artist: {
    fontSize: 14,
    marginBottom: 2,
  },
  time: {
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
  },
});
