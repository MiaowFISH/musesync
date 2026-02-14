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
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTheme } from '../hooks/useTheme';
import { usePlayer } from '../hooks/usePlayer';
import { useQueueSync } from '../hooks/useQueueSync';
import { musicApi } from '../services/api/MusicApi';
import { historyStorage } from '../services/storage/HistoryStorage';
import { preferencesStorage } from '../services/storage/PreferencesStorage';
import { playbackStateStorage } from '../services/storage/PlaybackStateStorage';
import { syncService } from '../services/sync/SyncService';
import { toast } from '../components/common/Toast';
import type { Track } from '@shared/types/entities';
import { useRoomStore, useConnectionStore } from '../stores';
import { PlayIcon } from '../components/common/PlayIcon';
import { QueueBottomSheet } from '../components/queue/QueueBottomSheet';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ALBUM_ART_SIZE = Math.min(SCREEN_WIDTH - 64, 320);

type RouteParams = {
  trackId: string;
  track?: Track;
};

export default function PlayerScreen() {
  const route = useRoute();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const theme = useTheme();
  const { trackId, track: initialTrack } = (route.params as RouteParams) || {};
  const roomStore = useRoomStore();
  const connectionStore = useConnectionStore();
  const [deviceId, setDeviceId] = useState<string>('');

  const [track, setTrack] = useState<Track | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioUrlExpiry, setAudioUrlExpiry] = useState<number>(0);
  const [isLoadingTrack, setIsLoadingTrack] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trialInfo, setTrialInfo] = useState<{ isTrial: boolean; start: number; end: number; duration: number } | null>(null);
  const [lyrics, setLyrics] = useState<Array<{ time: number; text: string }>>([]);
  const [translatedLyrics, setTranslatedLyrics] = useState<Array<{ time: number; text: string }>>([]);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);
  const [showLyrics, setShowLyrics] = useState(false); // Default hide lyrics
  const [showTranslation, setShowTranslation] = useState(false); // Show translation toggle
  const lyricsScrollRef = useRef<ScrollView>(null);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const versionRef = useRef<number>(0); // Track latest version for sync operations
  
  const {
    isPlaying,
    currentTrack: globalCurrentTrack,
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

  const {
    playlist,
    currentTrackIndex,
    loopMode,
    isQueueLoading,
    handleRemove,
    handleReorder,
    handleTrackPress,
    handleLoopModeToggle,
    handleAddSong,
  } = useQueueSync({
    roomId: roomStore.room?.roomId,
    userId: deviceId,
    isConnected: connectionStore.isConnected,
  });

  // Load device ID on mount
  useEffect(() => {
    const loadDeviceId = async () => {
      const id = await preferencesStorage.getDeviceId();
      setDeviceId(id);
      console.log('[PlayerScreen] Loaded device ID:', id);
    };
    loadDeviceId();
    
    // Initialize version ref from room state
    if (roomStore.room?.syncState?.version !== undefined) {
      versionRef.current = roomStore.room.syncState.version;
      console.log('[PlayerScreen] Initialized version ref:', versionRef.current);
    }
  }, [roomStore.room?.syncState?.version]);

  // Sync local track state with global current track
  useEffect(() => {
    if (globalCurrentTrack && globalCurrentTrack.trackId !== track?.trackId) {
      console.log('[PlayerScreen] Global track changed, updating local state:', globalCurrentTrack.title);
      setTrack(globalCurrentTrack);
      setAudioUrl(globalCurrentTrack.audioUrl || null);
      // Clear error when track changes
      setError(null);
    }
  }, [globalCurrentTrack, track?.trackId]);

  /**
   * Load track details and audio URL
   */
  useEffect(() => {
    if (!trackId) {
      setError('No track ID provided');
      return;
    }

    // Check if track is already loaded
    if (globalCurrentTrack?.trackId === trackId) {
      console.log('[PlayerScreen] Track already loaded, checking audioUrl validity');
      setTrack(globalCurrentTrack);
      
      // Check if audioUrl exists and is not expired
      const hasValidAudioUrl = globalCurrentTrack.audioUrl && 
                                globalCurrentTrack.audioUrlExpiry && 
                                globalCurrentTrack.audioUrlExpiry > Date.now();
      
      if (hasValidAudioUrl) {
        console.log('[PlayerScreen] Using cached audioUrl');
        setAudioUrl(globalCurrentTrack.audioUrl || null);
        // Load lyrics for cached track
        loadLyrics(trackId);
        return;
      } else {
        console.log('[PlayerScreen] AudioUrl missing or expired, fetching new one');
        // Fetch fresh audio URL
        fetchAudioUrl(trackId, globalCurrentTrack);
        // Load lyrics
        loadLyrics(trackId);
        return;
      }
    }

    loadTrack();
  }, [trackId, globalCurrentTrack]);

  /**
   * Fetch audio URL for existing track
   */
  const fetchAudioUrl = async (trackId: string, existingTrack: Track) => {
    try {
      const audioResponse = await musicApi.getAudioUrl(trackId, { quality: 'exhigh' });
      
      if (audioResponse.success && audioResponse.data && audioResponse.data.audioUrl) {
        const updatedTrack = {
          ...existingTrack,
          audioUrl: audioResponse.data.audioUrl,
          audioUrlExpiry: audioResponse.data.audioUrlExpiry,
        };
        
        setTrack(updatedTrack);
        setAudioUrl(audioResponse.data.audioUrl);
        
        // Auto-play if this matches the current track and was playing
        if (isPlaying || position > 0) {
          console.log('[PlayerScreen] Resuming with fresh audioUrl');
          await play(updatedTrack, audioResponse.data.audioUrl);
          if (position > 0) {
            seek(position);
          }
        }
      } else {
        console.error('[PlayerScreen] Failed to get audio URL');
        setError('Failed to load audio URL');
      }
    } catch (error) {
      console.error('[PlayerScreen] Fetch audio URL error:', error);
      setError('Failed to load audio URL');
    }
  };

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
          coverUrl: initialTrack.coverUrl || '',
          duration: initialTrack.duration,
          audioUrl: '',
          audioUrlExpiry: 0,
          quality: 'exhigh',
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
          coverUrl: detail.coverUrl,
          duration: detail.duration,
          audioUrl: '',
          audioUrlExpiry: 0,
          quality: 'exhigh',
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
        
        // Restore saved position if this is the same track
        let restoredPosition = 0;
        try {
          const savedState = await playbackStateStorage.getState();
          if (savedState && savedState.track && savedState.track.trackId === trackData.trackId && savedState.position > 0) {
            console.log('[PlayerScreen] Restoring saved position:', savedState.position);
            restoredPosition = savedState.position;
            seek(savedState.position);
            // Resume playback if it was playing
            if (savedState.isPlaying) {
              await resume();
            } else {
              pause();
            }
          }
        } catch (restoreErr) {
          console.error('[PlayerScreen] Failed to restore position:', restoreErr);
        }
        
        // Send sync event if in room
        if (roomStore.room && deviceId) {
          console.log('[PlayerScreen] Sending initial play sync event to room:', roomStore.room.roomId, 'version:', versionRef.current);
          const syncResult = await syncService.emitPlay({
            roomId: roomStore.room.roomId,
            userId: deviceId,
            trackId: trackData.trackId,
            seekTime: restoredPosition,
            version: versionRef.current,
          });
          if (!syncResult.success) {
            console.error('[PlayerScreen] Failed to send initial play sync:', syncResult.error);
            // If room not found, clear room state
            if (syncResult.error?.includes('not found') || syncResult.error?.includes('不存在')) {
              toast.error('房间已失效');
              roomStore.clear();
            }
          }
          // Always update version from server response
          if (syncResult.currentState) {
            versionRef.current = syncResult.currentState.version;
            console.log('[PlayerScreen] Updated version ref after initial play:', versionRef.current);
            roomStore.updateSyncState(syncResult.currentState);
          }
        }
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
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, []);

  /**
   * Heartbeat mechanism: Host sends periodic updates to keep room in sync
   */
  useEffect(() => {
    // Clear existing interval
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null; // Prevent duplicate intervals
    }

    // Only send heartbeats if:
    // 1. In a room
    // 2. Is room host
    // 3. Currently playing
    // 4. Has valid track
    const isHost = roomStore.room?.hostId === deviceId;
    if (!roomStore.room || !isHost || !isPlaying || !track) {
      return;
    }

    console.log('[PlayerScreen] Starting heartbeat mechanism as host');

    // Send heartbeat every 3 seconds
    heartbeatIntervalRef.current = setInterval(() => {
      if (!roomStore.room || !track || !deviceId) return;

      const heartbeat = {
        roomId: roomStore.room.roomId,
        fromUserId: deviceId,
        syncState: {
          trackId: track.trackId,
          status: isPlaying ? ('playing' as const) : ('paused' as const),
          seekTime: position,
          serverTimestamp: Date.now(),
          playbackRate: 1.0,
          volume: volume,
          updatedBy: deviceId,
          version: versionRef.current,
        },
        clientTime: Date.now(),
      };

      // Emit heartbeat via socket
      syncService.emit('sync:heartbeat', heartbeat);
    }, 3000); // 3 seconds interval

    // Cleanup on unmount or when dependencies change
    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [roomStore.room, deviceId, isPlaying, track, position, volume]);

  /**
   * Load and parse lyrics
   */
  const loadLyrics = async (trackId: string) => {
    try {
      const response = await musicApi.getLyrics(trackId);
      if (response.success && response.data) {
        if (response.data.lrc) {
          const parsedLyrics = parseLrc(response.data.lrc);
          setLyrics(parsedLyrics);
          console.log(`[PlayerScreen] Loaded ${parsedLyrics.length} lyrics lines`);
        }
        
        // Load translated lyrics if available
        if (response.data.tlyric) {
          const parsedTranslated = parseLrc(response.data.tlyric);
          setTranslatedLyrics(parsedTranslated);
          console.log(`[PlayerScreen] Loaded ${parsedTranslated.length} translated lyrics lines`);
        } else {
          setTranslatedLyrics([]);
        }
      } else {
        setLyrics([]);
        setTranslatedLyrics([]);
      }
    } catch (err) {
      console.error('[PlayerScreen] Load lyrics error:', err);
      setLyrics([]);
      setTranslatedLyrics([]);
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
   * Toggle lyrics display
   */
  const toggleLyrics = () => {
    setShowLyrics(!showLyrics);
  };

  /**
   * Toggle play/pause
   */
  const handlePlayPause = async () => {
    if (isPlaying) {
      pause();
      // Emit pause event if in room
      if (roomStore.room && track && deviceId) {
        console.log('[PlayerScreen] Emitting pause event to room:', roomStore.room.roomId, 'version:', versionRef.current);
        const result = await syncService.emitPause({
          roomId: roomStore.room.roomId,
          userId: deviceId,
          seekTime: position,
          version: versionRef.current,
        });
        if (!result.success) {
          console.error('[PlayerScreen] Failed to emit pause:', result.error);
        }
        // Always update version from server response
        if (result.currentState) {
          versionRef.current = result.currentState.version;
          console.log('[PlayerScreen] Updated version ref after pause:', versionRef.current);
          roomStore.updateSyncState(result.currentState);
        }
      }
    } else {
      if (audioUrl && track) {
        await resume();
        // Emit play event if in room
        if (roomStore.room && track && deviceId) {
          console.log('[PlayerScreen] Emitting play event to room:', roomStore.room.roomId, 'version:', versionRef.current);
          const result = await syncService.emitPlay({
            roomId: roomStore.room.roomId,
            userId: deviceId,
            trackId: track.trackId,
            seekTime: position,
            version: versionRef.current,
          });
          if (!result.success) {
            console.error('[PlayerScreen] Failed to emit play:', result.error);
          }
          // Always update version from server response
          if (result.currentState) {
            versionRef.current = result.currentState.version;
            console.log('[PlayerScreen] Updated version ref after play:', versionRef.current);
            roomStore.updateSyncState(result.currentState);
          }
        }
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
      // Emit seek event if in room
      if (roomStore.room && track && deviceId) {
        console.log('[PlayerScreen] Emitting seek event to room:', roomStore.room.roomId, 'version:', versionRef.current);
        syncService.emitSeek({
          roomId: roomStore.room.roomId,
          userId: deviceId,
          seekTime: newPosition,
          version: versionRef.current,
        }).then(result => {
          if (!result.success) {
            console.error('[PlayerScreen] Failed to emit seek:', result.error);
          }
          // Always update version from server response
          if (result.currentState) {
            versionRef.current = result.currentState.version;
            console.log('[PlayerScreen] Updated version ref after seek:', versionRef.current);
            roomStore.updateSyncState(result.currentState);
          }
        });
      }
    }
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
        
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.colors.text }]} numberOfLines={1}>
            {roomStore.room ? `房间 ${roomStore.room.roomId}` : '正在播放'}
          </Text>
          {roomStore.room && (
            <Text style={[styles.headerSubtitle, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              {roomStore.room.members.length} 人 • {roomStore.isHost ? '主持人' : '成员'}
            </Text>
          )}
        </View>

        <View style={styles.headerRight} />
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
            {lyrics.map((line, index) => {
              const translatedLine = translatedLyrics.find(t => Math.abs(t.time - line.time) < 0.5);
              return (
                <TouchableOpacity
                  key={index}
                  onPress={() => seek(line.time)}
                  activeOpacity={0.7}
                  style={styles.lyricLineContainer}
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
                  {showTranslation && translatedLine && (
                    <Text
                      style={[
                        styles.translatedLine,
                        { color: theme.colors.textSecondary },
                        index === currentLyricIndex && {
                          color: theme.colors.primary,
                          opacity: 0.8,
                        },
                      ]}
                    >
                      {translatedLine.text}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <View style={styles.lyricsControls}>
            <TouchableOpacity
              style={[styles.lyricsButton, { backgroundColor: theme.colors.surface }]}
              onPress={() => setShowLyrics(false)}
            >
              <Text style={[styles.lyricsButtonText, { color: theme.colors.primary }]}>
                显示封面
              </Text>
            </TouchableOpacity>
            {translatedLyrics.length > 0 && (
              <TouchableOpacity
                style={[styles.lyricsButton, { backgroundColor: theme.colors.surface }]}
                onPress={() => setShowTranslation(!showTranslation)}
              >
                <Text style={[styles.lyricsButtonText, { color: theme.colors.primary }]}>
                  {showTranslation ? '隐藏翻译' : '显示翻译'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : (
        <TouchableOpacity
          style={styles.albumArtContainer}
          onPress={() => lyrics.length > 0 && setShowLyrics(true)}
          activeOpacity={lyrics.length > 0 ? 0.8 : 1}
        >
          {track.coverUrl ? (
            <Image
              source={{ uri: track.coverUrl }}
              style={[styles.albumArt, { backgroundColor: theme.colors.surface }]}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.albumArt, styles.placeholderArt, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.placeholderIcon, { color: theme.colors.textSecondary }]}>♪</Text>
            </View>
          )}
          {lyrics.length > 0 && (
            <View style={[styles.lyricsHint, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.lyricsHintText, { color: theme.colors.primary }]}>
                点击查看歌词
              </Text>
            </View>
          )}
        </TouchableOpacity>
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
          style={[
            styles.controlButton,
            { 
              backgroundColor: theme.colors.primary,
              shadowColor: theme.colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }
          ]}
          onPress={handlePlayPause}
          disabled={isPlayerLoading}
          activeOpacity={0.8}
        >
          {isPlayerLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <PlayIcon isPlaying={isPlaying} size={36} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>

      {/* Error Message */}
      {playerError && (
        <Text style={[styles.errorMessage, { color: theme.colors.error }]}>
          {playerError}
        </Text>
      )}

      {/* Queue Bottom Sheet */}
      {roomStore.room && (
        <QueueBottomSheet
          playlist={playlist}
          currentTrackIndex={currentTrackIndex}
          loopMode={loopMode}
          isLoading={isQueueLoading}
          isConnected={connectionStore.isConnected}
          onAddSong={handleAddSong}
          onRemove={handleRemove}
          onReorder={handleReorder}
          onTrackPress={handleTrackPress}
          onLoopModeToggle={handleLoopModeToggle}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 16,
    paddingBottom: 100,
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 2,
  },
  headerRight: {
    width: 44,
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
  lyricLineContainer: {
    marginVertical: 8,
  },
  lyricLine: {
    fontSize: 16,
    lineHeight: 28,
    textAlign: 'center',
  },
  translatedLine: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 4,
    opacity: 0.7,
  },
  lyricsControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 16,
  },
  lyricsButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  lyricsButtonText: {
    fontSize: 14,
    fontWeight: '600',
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
  lyricsHint: {
    position: 'absolute',
    bottom: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    opacity: 0.9,
  },
  lyricsHintText: {
    fontSize: 12,
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
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
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
