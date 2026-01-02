// app/src/screens/PlayerScreen.tsx
// Music player screen with playback controls

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTheme } from '../hooks/useTheme';
import { usePlayer } from '../hooks/usePlayer';
import { musicApi } from '../services/api/MusicApi';
import { historyStorage } from '../services/storage/HistoryStorage';
import { toast } from '../components/common/Toast';
import type { Track } from '@shared/types/entities';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ALBUM_ART_SIZE = Math.min(SCREEN_WIDTH - 64, 320);

type RouteParams = {
  trackId: string;
  track?: any;
};

export default function PlayerScreen() {
  const route = useRoute();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const theme = useTheme();
  const { trackId, track: initialTrack } = (route.params as RouteParams) || {};
  
  const [track, setTrack] = useState<Track | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioUrlExpiry, setAudioUrlExpiry] = useState<number>(0);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trialInfo, setTrialInfo] = useState<{ isTrial: boolean; start: number; end: number; duration: number } | null>(null);
  const [lyrics, setLyrics] = useState<Array<{ time: number; text: string }>>([]);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);
  const [showLyrics, setShowLyrics] = useState(false);
  const lyricsScrollRef = useRef<ScrollView>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const {
    isPlaying,
    position,
    duration,
    volume,
    play,
    pause,
    resume,
    seek,
    setVolume,
    error: playerError,
    isLoading: isPlayerLoading,
  } = usePlayer();

  /**
   * Load track details and audio URL
   */
  useEffect(() => {
    if (!trackId) {
      setError('No track ID provided');
      return;
    }

    loadTrack();
  }, [trackId]);

  const loadTrack = async () => {
    setIsLoadingTrack(true);
    setError(null);

    try {
      // Get track details
      let trackData: Track;
      
      if (initialTrack) {
        // Use initial track data from navigation params
        trackData = {
          trackId: initialTrack.trackId,
          title: initialTrack.title,
          artist: initialTrack.artist,
          album: initialTrack.album || '',
          albumArt: initialTrack.albumArt || '',
          duration: initialTrack.duration,
          addedBy: '',
          addedAt: Date.now(),
        };
      } else {
        // Fetch from API
        const detailResponse = await musicApi.getSongDetail(trackId);
        if (!detailResponse.success || !detailResponse.data) {
          throw new Error(detailResponse.error?.message || 'Failed to load track');
        }

        const detail = detailResponse.data;
        trackData = {
          trackId: detail.trackId,
          title: detail.title,
          artist: detail.artist,
          album: detail.album,
          albumArt: detail.albumArt,
          duration: detail.duration,
          addedBy: '',
          addedAt: Date.now(),
        };
      }

      setTrack(trackData);

      // Get audio URL
      const audioResponse = await musicApi.getAudioUrl(trackId, { quality: 'exhigh' });
      if (!audioResponse.success || !audioResponse.data) {
        throw new Error(audioResponse.error?.message || 'Failed to get audio URL');
      }

      setAudioUrl(audioResponse.data.audioUrl);
      setAudioUrlExpiry(audioResponse.data.audioUrlExpiry);

      // Setup proactive refresh (5 minutes before expiry)
      setupAudioUrlRefresh(trackId, audioResponse.data.audioUrlExpiry);

      // Check if this is a trial version
      console.log('[PlayerScreen] Audio response:', {
        isTrial: audioResponse.data.isTrial,
        trialStart: audioResponse.data.trialStart,
        trialEnd: audioResponse.data.trialEnd,
      });
      
      if (audioResponse.data.isTrial && 
          typeof audioResponse.data.trialEnd === 'number' && 
          typeof audioResponse.data.trialStart === 'number') {
        const trialDuration = audioResponse.data.trialEnd - audioResponse.data.trialStart; // Already in seconds
        setTrialInfo({
          isTrial: true,
          start: audioResponse.data.trialStart, // Already in seconds
          end: audioResponse.data.trialEnd, // Already in seconds
          duration: trialDuration,
        });
        
        // Update track duration to trial duration
        trackData = { ...trackData, duration: trialDuration };
        setTrack(trackData);
        
        console.warn(`[PlayerScreen] Trial version detected - ${trialDuration}s preview (${audioResponse.data.trialStart}s - ${audioResponse.data.trialEnd}s)`);
      } else {
        setTrialInfo(null);
      }

      // Auto-play
      if (audioResponse.data.audioUrl) {
        await play(trackData, audioResponse.data.audioUrl);
      }

      // Add to history
      try {
        console.log('[PlayerScreen] Adding track to history:', trackData.title);
        await historyStorage.addTrack(trackData);
        console.log('[PlayerScreen] Track added to history successfully');
      } catch (histErr) {
        console.error('[PlayerScreen] Failed to add track to history:', histErr);
      }

      // Load lyrics
      loadLyrics(trackId);
    } catch (err) {
      console.error('[PlayerScreen] Load track error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load track';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoadingTrack(false);
    }
  };

  /**
   * Setup proactive audio URL refresh (5 minutes before expiry)
   */
  const setupAudioUrlRefresh = (trackId: string, expiryTimestamp: number) => {
    // Clear existing timer
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    // Calculate time until refresh (5 minutes before expiry)
    const now = Date.now();
    const timeUntilRefresh = expiryTimestamp - now - (5 * 60 * 1000); // 5 minutes

    if (timeUntilRefresh > 0) {
      console.log(`[PlayerScreen] Audio URL will refresh in ${Math.round(timeUntilRefresh / 1000)}s`);
      
      refreshTimerRef.current = setTimeout(async () => {
        try {
          console.log('[PlayerScreen] Refreshing audio URL...');
          const response = await musicApi.getAudioUrl(trackId, { quality: 'exhigh', refresh: true });
          
          if (response.success && response.data) {
            const currentPosition = position;
            setAudioUrl(response.data.audioUrl);
            setAudioUrlExpiry(response.data.audioUrlExpiry);
            
            // Resume playback at current position
            if (track && response.data.audioUrl) {
              await play(track, response.data.audioUrl);
              seek(currentPosition);
            }
            
            // Setup next refresh
            setupAudioUrlRefresh(trackId, response.data.audioUrlExpiry);
            toast.success('Audio URL refreshed');
          }
        } catch (error) {
          console.error('[PlayerScreen] Audio URL refresh error:', error);
          toast.error('Failed to refresh audio URL');
        }
      }, timeUntilRefresh);
    }
  };

  // Cleanup refresh timer on unmount
  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
      }
    };
  }, []);

  /**
   * Load and parse lyrics
   */
  const loadLyrics = async (trackId: string) => {
    try {
      const response = await musicApi.getLyrics(trackId);
      if (response.success && response.data && response.data.lrc) {
        const parsedLyrics = parseLrc(response.data.lrc);
        setLyrics(parsedLyrics);
        console.log(`[PlayerScreen] Loaded ${parsedLyrics.length} lyrics lines`);
      } else {
        setLyrics([]);
      }
    } catch (err) {
      console.error('[PlayerScreen] Load lyrics error:', err);
      setLyrics([]);
    }
  };

  /**
   * Parse LRC format lyrics
   */
  const parseLrc = (lrc: string): Array<{ time: number; text: string }> => {
    const lines = lrc.split('\n');
    const result: Array<{ time: number; text: string }> = [];

    for (const line of lines) {
      // Match [mm:ss.xx] or [mm:ss]
      const match = line.match(/\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\](.*)/);
      if (match) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const milliseconds = match[3] ? parseInt(match[3].padEnd(3, '0'), 10) : 0;
        const time = minutes * 60 + seconds + milliseconds / 1000;
        const text = match[4].trim();
        
        if (text) {
          result.push({ time, text });
        }
      }
    }

    // Sort by time
    result.sort((a, b) => a.time - b.time);
    return result;
  };

  /**
   * Sync lyrics with playback position
   */
  useEffect(() => {
    if (lyrics.length === 0) return;

    // Find current lyric line
    let index = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (position >= lyrics[i].time) {
        index = i;
      } else {
        break;
      }
    }

    if (index !== currentLyricIndex) {
      setCurrentLyricIndex(index);
      
      // Auto-scroll to current lyric
      if (showLyrics && index >= 0 && lyricsScrollRef.current) {
        lyricsScrollRef.current.scrollTo({
          y: index * 40, // Approximate line height
          animated: true,
        });
      }
    }
  }, [position, lyrics, showLyrics]);

  /**
   * Toggle play/pause
   */
  const handlePlayPause = async () => {
    if (isPlaying) {
      pause();
    } else {
      if (audioUrl && track) {
        await resume();
      }
    }
  };

  /**
   * Format time (seconds) to mm:ss
   */
  const formatTime = (seconds: number): string => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * Handle progress bar press
   */
  const handleProgressPress = (event: any) => {
    if (!duration || !Number.isFinite(duration)) return;

    // Get touch position - handle both native and web events
    const touch = event.nativeEvent;
    const locationX = touch.locationX ?? touch.offsetX ?? 0;
    
    if (locationX === 0) {
      console.warn('[PlayerScreen] Unable to get touch location');
      return;
    }

    // Get actual progress bar width from the element
    const target = event.currentTarget || event.target;
    const progressBarWidth = target?.offsetWidth || SCREEN_WIDTH - 64;
    
    const percentage = Math.max(0, Math.min(1, locationX / progressBarWidth));
    const newPosition = percentage * duration;

    // Validate calculated position before seeking
    if (Number.isFinite(newPosition) && newPosition >= 0) {
      seek(newPosition);
    }
  };

  /**
   * Navigate to EQ screen
   */
  const handleOpenEQ = () => {
    navigation.navigate('EQ');
  };

  // Loading state
  if (isLoadingTrack) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
          加载中...
        </Text>
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.errorText, { color: theme.colors.error }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: theme.colors.primary }]}
          onPress={loadTrack}
        >
          <Text style={[styles.retryButtonText, { color: theme.colors.background }]}>
            重试
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!track) {
    return null;
  }

  const progress = duration > 0 ? position / duration : 0;

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
        
        <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>
          正在播放
        </Text>

        <TouchableOpacity
          style={styles.eqButton}
          onPress={handleOpenEQ}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.eqButtonText, { color: theme.colors.primary }]}>EQ</Text>
        </TouchableOpacity>
      </View>

      {/* Album Art or Lyrics */}
      {showLyrics && lyrics.length > 0 ? (
        <View style={styles.lyricsContainer}>
          <ScrollView 
            ref={lyricsScrollRef}
            style={styles.lyricsScroll}
            contentContainerStyle={styles.lyricsContent}
            showsVerticalScrollIndicator={false}
          >
            {lyrics.map((line, index) => (
              <TouchableOpacity
                key={index}
                onPress={() => seek(line.time)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.lyricLine,
                    { color: theme.colors.textSecondary },
                    index === currentLyricIndex && {
                      color: theme.colors.primary,
                      fontSize: 18,
                      fontWeight: '600',
                    },
                  ]}
                >
                  {line.text}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={[styles.lyricsToggle, { backgroundColor: theme.colors.surface }]}
            onPress={() => setShowLyrics(false)}
          >
            <Text style={[styles.lyricsToggleText, { color: theme.colors.primary }]}>
              显示封面
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.albumArtContainer}>
          {track.albumArt ? (
            <Image
              source={{ uri: track.albumArt }}
              style={[styles.albumArt, { backgroundColor: theme.colors.surface }]}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.albumArt, styles.placeholderArt, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.placeholderIcon, { color: theme.colors.textSecondary }]}>♪</Text>
            </View>
          )}
          {lyrics.length > 0 && (
            <TouchableOpacity
              style={[styles.lyricsToggle, { backgroundColor: theme.colors.surface }]}
              onPress={() => setShowLyrics(true)}
            >
              <Text style={[styles.lyricsToggleText, { color: theme.colors.primary }]}>
                显示歌词
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Track Info */}
      <View style={styles.trackInfo}>
        <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={2}>
          {track.title}
        </Text>
        <Text style={[styles.artist, { color: theme.colors.textSecondary }]} numberOfLines={1}>
          {track.artist}
        </Text>
        {track.album && (
          <Text style={[styles.album, { color: theme.colors.textSecondary }]} numberOfLines={1}>
            {track.album}
          </Text>
        )}
        {trialInfo?.isTrial && (
          <View style={[styles.trialBadge, { backgroundColor: theme.colors.warning || '#FF9800' }]}>
            <Text style={styles.trialText}>
              🎵 试听版 ({trialInfo.duration}秒)
            </Text>
          </View>
        )}
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>
          {formatTime(position)}
        </Text>
        
        <TouchableOpacity
          style={styles.progressBarContainer}
          onPress={handleProgressPress}
          activeOpacity={1}
        >
          <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
            {/* Trial range indicator */}
            {trialInfo && duration > 0 && (
              <View
                style={[
                  styles.trialRange,
                  {
                    backgroundColor: theme.colors.warning ? `${theme.colors.warning}40` : '#FF980040',
                    left: `${(trialInfo.start / duration) * 100}%`,
                    width: `${((trialInfo.end - trialInfo.start) / duration) * 100}%`,
                  },
                ]}
              />
            )}
            <View
              style={[
                styles.progressFill,
                { backgroundColor: theme.colors.primary, width: `${progress * 100}%` },
              ]}
            />
          </View>
        </TouchableOpacity>

        <Text style={[styles.timeText, { color: theme.colors.textSecondary }]}>
          {formatTime(duration)}
        </Text>
      </View>

      {/* Playback Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={handlePlayPause}
          disabled={isPlayerLoading}
        >
          {isPlayerLoading ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Text style={[styles.playButtonText, { color: theme.colors.primary }]}>
              {isPlaying ? '⏸' : '▶'}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Error Message */}
      {playerError && (
        <Text style={[styles.errorMessage, { color: theme.colors.error }]}>
          {playerError}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
    height: 44,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 32,
    lineHeight: 44,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  eqButton: {
    width: 44,
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  eqButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  albumArtContainer: {
    alignItems: 'center',
    marginBottom: 32,
    position: 'relative',
  },
  lyricsContainer: {
    flex: 1,
    marginBottom: 32,
    position: 'relative',
  },
  lyricsScroll: {
    flex: 1,
  },
  lyricsContent: {
    paddingVertical: 40,
    paddingHorizontal: 16,
  },
  lyricLine: {
    fontSize: 16,
    lineHeight: 40,
    textAlign: 'center',
    marginVertical: 4,
  },
  lyricsToggle: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    alignSelf: 'center',
  },
  lyricsToggleText: {
    fontSize: 14,
    fontWeight: '600',
  },
  albumArt: {
    width: ALBUM_ART_SIZE,
    height: ALBUM_ART_SIZE,
    borderRadius: 8,
  },
  placeholderArt: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderIcon: {
    fontSize: 64,
  },
  trackInfo: {
    alignItems: 'center',
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  artist: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 4,
  },
  album: {
    fontSize: 14,
    textAlign: 'center',
  },
  trialBadge: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  trialText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  timeText: {
    fontSize: 12,
    width: 40,
  },
  progressBarContainer: {
    flex: 1,
    paddingVertical: 12,
    marginHorizontal: 8,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  trialRange: {
    position: 'absolute',
    top: 0,
    height: '100%',
    zIndex: 1,
  },
  progressFill: {
    height: '100%',
    position: 'relative',
    zIndex: 2,
  },
  controls: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlButton: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonText: {
    fontSize: 48,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 32,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorMessage: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 32,
  },
});
