// app/src/screens/SearchScreen.tsx
// Music search screen with NetEase API integration

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../hooks/useTheme';
import { musicApi } from '../services/api/MusicApi';
import Input from '../components/ui/Input';
import type { SearchSong } from '@shared/types/api';

type NavigationProp = NativeStackNavigationProp<any>;

export default function SearchScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState<SearchSong[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  const performSearch = useCallback(async (keyword: string) => {
    if (!keyword || keyword.trim().length === 0) {
      setResults([]);
      setTotalCount(0);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await musicApi.search({
        keyword: keyword.trim(),
        limit: 20,
        offset: 0,
      });

      if (response.success && response.data) {
        setResults(response.data.songs);
        setTotalCount(response.data.totalCount);
      } else {
        setError(response.error?.message || 'Search failed');
        setResults([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error('[SearchScreen] Search error:', err);
      setError('Search failed');
      setResults([]);
      setTotalCount(0);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSearchChange = useCallback(
    (text: string) => {
      setSearchText(text);

      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }

      const newTimeout = setTimeout(() => {
        performSearch(text);
      }, 500);

      setSearchTimeout(newTimeout);
    },
    [performSearch, searchTimeout]
  );

  const handleSongPress = useCallback(
    (song: SearchSong) => {
      navigation.navigate('Player', {
        trackId: song.trackId,
        track: song,
      });
    },
    [navigation]
  );

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const renderSongItem = ({ item }: { item: SearchSong }) => (
    <TouchableOpacity
      style={[styles.songItem, { backgroundColor: theme.colors.surface }]}
      onPress={() => handleSongPress(item)}
      activeOpacity={0.7}
    >
      {item.albumArt ? (
        <Image source={{ uri: item.albumArt }} style={styles.albumArt} />
      ) : (
        <View style={[styles.albumArt, styles.placeholderArt, { backgroundColor: theme.colors.border }]}>
          <Text style={{ color: theme.colors.textSecondary, fontSize: 24 }}>♪</Text>
        </View>
      )}

      <View style={styles.songInfo}>
        <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.artist, { color: theme.colors.textSecondary }]} numberOfLines={1}>
          {item.artist}
        </Text>
        {item.album && (
          <Text style={[styles.album, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            {item.album}
          </Text>
        )}
      </View>

      <Text style={[styles.duration, { color: theme.colors.textSecondary }]}>
        {formatDuration(item.duration)}
      </Text>
    </TouchableOpacity>
  );

  const renderEmptyState = () => {
    if (isLoading) return null;

    if (error) {
      return (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.colors.error }]}>{error}</Text>
        </View>
      );
    }

    if (searchText.trim().length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
            搜索你喜欢的音乐
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
          未找到"{searchText}"的相关结果
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.searchBar}>
        <Input
          placeholder="搜索歌曲、歌手、专辑..."
          value={searchText}
          onChangeText={handleSearchChange}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.searchInput}
        />
        {searchText.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => handleSearchChange('')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={[styles.clearButtonText, { color: theme.colors.textSecondary }]}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {totalCount > 0 && !isLoading && (
        <View style={styles.resultsHeader}>
          <Text style={[styles.resultsCount, { color: theme.colors.textSecondary }]}>
            找到 {totalCount.toLocaleString()} 个结果
          </Text>
        </View>
      )}

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      )}

      <FlatList
        data={results}
        renderItem={renderSongItem}
        keyExtractor={(item) => item.trackId}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  searchInput: {
    flex: 1,
  },
  clearButton: {
    position: 'absolute',
    right: 28,
    top: '50%',
    marginTop: -12,
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resultsCount: {
    fontSize: 14,
  },
  loadingContainer: {
    padding: 32,
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 16,
  },
  songItem: {
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
  songInfo: {
    flex: 1,
    marginRight: 12,
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
  album: {
    fontSize: 12,
  },
  duration: {
    fontSize: 14,
    minWidth: 40,
    textAlign: 'right',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
  },
});
