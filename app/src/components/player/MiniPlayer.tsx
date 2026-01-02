// app/src/components/player/MiniPlayer.tsx
// Mini player bar that appears at bottom when navigating away from player

import React, { useState, useEffect, useRef } from 'react';
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
import { useRoomStore } from '../../stores';
import { syncService } from '../../services/sync/SyncService';
import { preferencesStorage } from '../../services/storage/PreferencesStorage';
import { PlayIcon } from '../common/PlayIcon';

export const MiniPlayer: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { colors, spacing } = useTheme();
  const roomStore = useRoomStore();
  const [deviceId, setDeviceId] = useState<string>('');
  const versionRef = useRef<number>(0);
  
  const { 
    currentTrack, 
    isPlaying,
    position,
    duration,
    isLoading,
    pause,
    resume,
    play,
  } = usePlayer();

  // Load device ID
  useEffect(() => {
    preferencesStorage.getDeviceId().then(setDeviceId);
  }, []);

  // Sync version ref with room state
  useEffect(() => {
    if (roomStore.room?.syncState?.version !== undefined) {
      versionRef.current = roomStore.room.syncState.version;
    }
  }, [roomStore.room?.syncState?.version]);

  if (!currentTrack) {
    return null;
  }

  const handlePlayPause = async () => {
    if (!currentTrack) return;

    try {
      if (isPlaying) {
        pause();
        // Emit pause sync if in room
        if (roomStore.room && deviceId) {
          const result = await syncService.emitPause({
            roomId: roomStore.room.roomId,
            userId: deviceId,
            seekTime: position,
            version: versionRef.current,
          });
          if (result.currentState) {
            versionRef.current = result.currentState.version;
            roomStore.updateSyncState(result.currentState);
          }
        }
      } else {
        // Resume playback (usePlayer will handle initialization if needed)
        await resume();

        // Emit play sync if in room
        if (roomStore.room && currentTrack && deviceId) {
          const result = await syncService.emitPlay({
            roomId: roomStore.room.roomId,
            userId: deviceId,
            trackId: currentTrack.trackId,
            seekTime: position,
            version: versionRef.current,
          });
          if (result.currentState) {
            versionRef.current = result.currentState.version;
            roomStore.updateSyncState(result.currentState);
          }
        }
      }
    } catch (error) {
      console.error('[MiniPlayer] Play/pause error:', error);
      // Only navigate on error
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

  const progressPercentage = duration > 0 ? (position / duration) * 100 : 0;

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.surface }]}
      onPress={handleOpenPlayer}
      activeOpacity={0.9}
    >
      {/* Progress Bar */}
      <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
        <View 
          style={[
            styles.progressFill, 
            { 
              width: `${progressPercentage}%`,
              backgroundColor: colors.primary,
            }
          ]} 
        />
      </View>

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
  progressBar: {
    height: 2,
    width: '100%',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
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
