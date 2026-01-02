// app/src/components/player/MiniPlayer.tsx
// Mini player bar that appears at bottom when navigating away from player

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../../hooks/useTheme';
import { usePlayer } from '../../hooks/usePlayer';
import { PlayIcon } from '../common/PlayIcon';

export const MiniPlayer: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { colors, spacing } = useTheme();
  const { 
    currentTrack, 
    isPlaying, 
    isLoading,
    play,
    pause,
    resume,
  } = usePlayer();

  if (!currentTrack) {
    return null;
  }

  const handlePlayPause = async () => {
    try {
      if (isPlaying) {
        await pause();
      } else {
        if (currentTrack.trackId && currentTrack.audioUrl) {
          await resume();
        } else {
          // If no audio loaded, navigate to player to load the track
          navigation.navigate('Player', {
            trackId: currentTrack.trackId,
            track: currentTrack,
          });
        }
      }
    } catch (error) {
      console.error('[MiniPlayer] Play/pause error:', error);
      // Navigate to player if resume fails (audio not initialized)
      navigation.navigate('Player', {
        trackId: currentTrack.trackId,
        track: currentTrack,
      });
    }
  };

  const handleOpenPlayer = () => {
    navigation.navigate('Player', {
      trackId: currentTrack.trackId,
      track: currentTrack,
    });
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.surface }]}
      onPress={handleOpenPlayer}
      activeOpacity={0.9}
    >
      <View style={styles.content}>
        {/* Album Art */}
        {currentTrack.coverUrl ? (
          <Image 
            source={{ uri: currentTrack.coverUrl }} 
            style={styles.albumArt}
          />
        ) : (
          <View style={[styles.albumArt, styles.placeholderArt, { backgroundColor: colors.border }]}>
            <Text style={{ color: colors.textSecondary, fontSize: 16 }}>♪</Text>
          </View>
        )}

        {/* Track Info */}
        <View style={styles.trackInfo}>
          <Text 
            style={[styles.title, { color: colors.text }]} 
            numberOfLines={1}
          >
            {currentTrack.title}
          </Text>
          <Text 
            style={[styles.artist, { color: colors.textSecondary }]} 
            numberOfLines={1}
          >
            {currentTrack.artist}
          </Text>
        </View>

        {/* Play/Pause Button */}
        <TouchableOpacity
          style={styles.playButton}
          onPress={handlePlayPause}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <PlayIcon isPlaying={isPlaying} size={28} color={colors.primary} />
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
    zIndex: 100,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    paddingBottom: 12,
  },
  albumArt: {
    width: 48,
    height: 48,
    borderRadius: 4,
    marginRight: 12,
  },
  placeholderArt: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackInfo: {
    flex: 1,
    marginRight: 12,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  artist: {
    fontSize: 12,
  },
  playButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
