// app/src/screens/RoomScreen.tsx
// Room screen - room management and member list

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { Room, User } from '@shared/types/entities';
import { socketManager } from '../services/sync/SocketManager';
import { roomService } from '../services/sync/RoomService';
import { syncService } from '../services/sync/SyncService';
import { toast } from '../components/common/Toast';
import { Button } from '../components/ui/Button';
import { ConnectionStatus } from '../components/common/ConnectionStatus';
import { usePlayer } from '../hooks/usePlayer';
import { useRoomStore } from '../stores';
import { musicApi } from '../services/api/MusicApi';
import type { Track } from '@shared/types/entities';
import type { SyncStateEvent, SyncHeartbeatEvent, MemberJoinedEvent, MemberLeftEvent } from '@shared/types/socket-events';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Room'>;
type RoomRouteProp = RouteProp<RootStackParamList, 'Room'>;

export const RoomScreen: React.FC = () => {
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoomRouteProp>();
  const { roomId, room: initialRoom, userId } = route.params;
  const { currentTrack, isPlaying, position, pause, resume, seek, play, loadTrack } = usePlayer();
  const roomStore = useRoomStore();

  const [room, setRoom] = useState<Room | null>(initialRoom || null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'error'>('connecting');

  // Set room in store when entering
  useEffect(() => {
    if (initialRoom) {
      console.log('[RoomScreen] Setting room in store:', initialRoom.roomId);
      roomStore.setRoom(initialRoom);
      setRoom(initialRoom);
    }
    
    // Don't clear room when leaving - only clear when explicitly leaving the room
    // Room state should persist when navigating to Player screen
  }, [initialRoom]);

  useEffect(() => {
    // Listen to connection state changes
    const unsubscribe = socketManager.onStateChange((state) => {
      const newState = state === 'connected' ? 'connected' : state === 'connecting' ? 'connecting' : 'error';
      setConnectionState(newState);
      
      // If reconnected, check if room still exists
      if (state === 'connected' && room) {
        console.log('[RoomScreen] Reconnected, verifying room still exists...');
        // The room might have been destroyed on server restart
        // We'll rely on error events to detect this
      }
    });

    // Listen to room events
    const socket = socketManager.getSocket();
    if (socket) {
      // Member joined event
      socket.on('member:joined', (data: MemberJoinedEvent) => {
        console.log('[RoomScreen] Member joined:', data);
        if (data.room) {
          setRoom(data.room);
          roomStore.setRoom(data.room);
        }
        toast.success(`${data.username} 加入了房间`);
      });

      // Member left event
      socket.on('member:left', (data: MemberLeftEvent) => {
        console.log('[RoomScreen] Member left:', data);
        if (data.room) {
          setRoom(data.room);
          roomStore.setRoom(data.room);
        }
        
        if (data.newHostId) {
          toast.info('主持人已离开，管理权已转移');
        } else {
          toast.info('有成员离开了房间');
        }
      });

      // Sync state update - apply to local player
      socket.on('sync:state', async (data: SyncStateEvent) => {
        console.log('[RoomScreen] Sync state received:', JSON.stringify(data, null, 2));
        if (data.syncState && room) {
          const syncState = data.syncState;
          console.log('[RoomScreen] Sync state details:', {
            trackId: syncState.trackId,
            status: syncState.status,
            position: syncState.seekTime,
            updatedBy: syncState.updatedBy,
          });
          
          const updatedRoom = {
            ...room,
            syncState,
          };
          setRoom(updatedRoom);
          roomStore.setRoom(updatedRoom);

          // Don't sync if this is our own update
          if (syncState.updatedBy === userId) {
            console.log('[RoomScreen] Ignoring own sync update (updatedBy match)');
            return;
          }

          // Apply sync state to player
          if (syncState.trackId && syncState.status !== 'stopped') {
            console.log('[RoomScreen] Current track:', currentTrack?.trackId, 'Sync track:', syncState.trackId);
            console.log('[RoomScreen] Track comparison:', {
              currentTrackId: currentTrack?.trackId,
              syncTrackId: syncState.trackId,
              typesMatch: typeof currentTrack?.trackId === typeof syncState.trackId,
              valuesMatch: currentTrack?.trackId === syncState.trackId,
              stringMatch: String(currentTrack?.trackId) === String(syncState.trackId),
            });
            // If we're not playing the same track, load and play it
            if (!currentTrack || String(currentTrack.trackId) !== String(syncState.trackId)) {
              console.log('[RoomScreen] Different track, loading:', syncState.trackId);
              try {
                // Fetch track details
                const songResponse = await musicApi.getSongDetail(syncState.trackId);
                console.log('[RoomScreen] Song detail response:', songResponse);
                
                if (songResponse.success && songResponse.data) {
                  const songDetail = songResponse.data;
                  console.log('[RoomScreen] Song detail:', {
                    title: songDetail.title,
                    artist: songDetail.artist,
                    duration: songDetail.duration,
                  });
                  
                  // Fetch audio URL
                  const audioResponse = await musicApi.getAudioUrl(syncState.trackId);
                  console.log('[RoomScreen] Audio URL response:', audioResponse);
                  
                  if (audioResponse.success && audioResponse.data && audioResponse.data.audioUrl) {
                    const track: Track = {
                      trackId: syncState.trackId,
                      title: songDetail.title || 'Unknown Title',
                      artist: songDetail.artist || 'Unknown Artist',
                      album: songDetail.album || '',
                      coverUrl: songDetail.coverUrl || '',
                      duration: songDetail.duration,
                      audioUrl: audioResponse.data.audioUrl,
                      audioUrlExpiry: audioResponse.data.audioUrlExpiry,
                      quality: audioResponse.data.quality || 'exhigh',
                      addedAt: Date.now(),
                    };

                    console.log('[RoomScreen] Track prepared:', {
                      trackId: track.trackId,
                      title: track.title,
                      audioUrl: track.audioUrl ? 'valid' : 'undefined',
                    });

                    // Play track with audio URL
                    console.log('[RoomScreen] Playing synced track:', track.title);
                    await play(track, audioResponse.data.audioUrl);
                    
                    // Apply playback state
                    if (syncState.status === 'playing') {
                      console.log('[RoomScreen] Seeking to position and resuming:', syncState.seekTime);
                      seek(syncState.seekTime || 0);
                      // Already playing from play() call
                    } else {
                      console.log('[RoomScreen] Pausing at position:', syncState.seekTime);
                      seek(syncState.seekTime || 0);
                      pause();
                    }
                    
                    toast.success(`已同步: ${track.title}`);
                  } else {
                    console.error('[RoomScreen] Failed to get audio URL:', audioResponse);
                    toast.error('无法获取音频链接');
                  }
                } else {
                  console.error('[RoomScreen] Failed to get song details:', songResponse);
                  toast.error('无法加载歌曲信息');
                }
              } catch (error) {
                console.error('[RoomScreen] Error loading synced track:', error);
                toast.error('同步失败');
              }
            } else if (currentTrack.trackId === syncState.trackId) {
              // Same track, sync playback state
              console.log('[RoomScreen] Same track, checking sync state');
              
              // Calculate network delay compensation
              const now = Date.now();
              const syncAge = (now - syncState.serverTimestamp) / 1000; // seconds
              console.log('[RoomScreen] Sync age (network delay):', syncAge, 'seconds');
              
              // Calculate expected position with delay compensation
              let expectedPosition = syncState.seekTime || 0;
              if (syncState.status === 'playing') {
                // If playing, compensate for the time since sync was sent
                expectedPosition += syncAge;
                console.log('[RoomScreen] Compensated position:', expectedPosition);
              }
              
              // Check position drift (use smaller threshold for better sync)
              const timeDrift = Math.abs(position - expectedPosition);
              console.log('[RoomScreen] Time drift:', timeDrift, 'current:', position, 'expected:', expectedPosition);
              if (timeDrift > 0.5) { // Reduced from 1 second to 0.5 seconds
                console.log('[RoomScreen] Seeking to compensated position:', expectedPosition);
                seek(expectedPosition);
              }
              
              // Then sync play/pause state
              if (syncState.status === 'playing' && !isPlaying) {
                console.log('[RoomScreen] Syncing: Resume playback');
                resume();
              } else if (syncState.status === 'paused' && isPlaying) {
                console.log('[RoomScreen] Syncing: Pause playback');
                pause();
              }
            }
          }
        }
      });

      // Room error (e.g., room not found after reconnection)
      socket.on('error', (data: any) => {
        console.error('[RoomScreen] Socket error:', data);
        if (data.message?.includes('not found') || data.message?.includes('不存在')) {
          toast.error('房间已失效，请重新创建');
          roomStore.clear();
          navigation.navigate('Home');
        }
      });

      // Check if room still exists
      socket.on('room:error', (data: { error: string }) => {
        console.error('[RoomScreen] Room error:', data);
        if (data.error?.includes('not found') || data.error?.includes('不存在')) {
          toast.error('房间已失效');
          roomStore.clear();
          navigation.navigate('Home');
        }
      });

      // Heartbeat listener - micro-adjust playback position
      socket.on('sync:heartbeat', async (data: SyncHeartbeatEvent) => {
        console.log('[RoomScreen] Received heartbeat from host');
        
        // Only listeners (non-hosts) should react to heartbeats
        if (!room || room.hostId === userId) {
          return;
        }

        const syncState = data.syncState;
        if (!syncState) return;

        // Update room store with latest state
        roomStore.updateSyncState(syncState);

        // Calculate expected position with network delay compensation
        const now = Date.now();
        const syncAge = (now - syncState.serverTimestamp) / 1000;
        let expectedPosition = syncState.seekTime;

        if (syncState.status === 'playing') {
          expectedPosition += syncAge;
        }

        // Micro-adjust if drift is significant (>0.3s)
        const drift = Math.abs(position - expectedPosition);
        if (drift > 0.3) {
          console.log(`[RoomScreen] Heartbeat: Drift detected (${drift.toFixed(2)}s), adjusting...`);
          seek(expectedPosition);
        }

        // Sync playing state
        if (syncState.status === 'playing' && !isPlaying) {
          console.log('[RoomScreen] Heartbeat: Resuming playback');
          await resume();
        } else if (syncState.status === 'paused' && isPlaying) {
          console.log('[RoomScreen] Heartbeat: Pausing playback');
          pause();
        }
      });
    }

    return () => {
      unsubscribe();
      if (socket) {
        socket.off('member:joined');
        socket.off('member:left');
        socket.off('sync:state');
        socket.off('sync:heartbeat');
        socket.off('error');
        socket.off('room:error');
      }
    };
  }, [room, navigation, userId, position, isPlaying]);

  const handleLeaveRoom = async () => {
    // Use window.confirm for web compatibility
    const confirmed = Platform.OS === 'web' 
      ? window.confirm('确定要离开房间吗？')
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            '离开房间',
            '确定要离开房间吗？',
            [
              { text: '取消', style: 'cancel', onPress: () => resolve(false) },
              { text: '离开', style: 'destructive', onPress: () => resolve(true) },
            ]
          );
        });

    if (!confirmed) return;

    try {
      if (room && userId) {
        console.log('[RoomScreen] Leaving room:', roomId, 'userId:', userId);
        await roomService.leaveRoom({ roomId, userId });
        // Clear room from store when explicitly leaving
        roomStore.clear();
        toast.success('已离开房间');
      }
      navigation.navigate('Home');
    } catch (error) {
      console.error('[RoomScreen] Leave room error:', error);
      toast.error('离开房间失败');
      // Clear room and navigate home even if leave fails
      roomStore.clear();
      navigation.navigate('Home');
    }
  };

  const handleGoToPlayer = () => {
    // If there's a current track playing, go to player
    if (currentTrack) {
      navigation.navigate('Player', {
        trackId: currentTrack.trackId,
        track: currentTrack,
      });
    } else {
      // Otherwise go to search to select a track
      navigation.navigate('Search');
    }
  };

  const formatDeviceType = (type: string) => {
    switch (type) {
      case 'ios': return '📱 iOS';
      case 'android': return '📱 Android';
      case 'web': return '💻 Web';
      default: return '📱';
    }
  };

  const renderMemberItem = (member: User, isHost: boolean) => (
    <View
      key={member.userId}
      style={[
        styles.memberItem,
        { backgroundColor: colors.surface, borderColor: colors.border }
      ]}
    >
      <View style={styles.memberInfo}>
        <View style={styles.memberHeader}>
          <Text style={[styles.memberName, { color: colors.text }]}>
            {member.username}
          </Text>
          {isHost && (
            <View style={[styles.hostBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.hostBadgeText}>主持人</Text>
            </View>
          )}
        </View>
        <View style={styles.memberDetails}>
          <Text style={[styles.memberDetail, { color: colors.textSecondary }]}>
            {formatDeviceType(member.deviceType)}
          </Text>
          <Text style={[styles.memberDetail, { color: colors.textSecondary }]}>
            {' • '}
          </Text>
          <Text style={[styles.memberDetail, { color: colors.textSecondary }]}>
            {member.connectionState === 'connected' ? '🟢 在线' : '🔴 离线'}
          </Text>
          {member.latency > 0 && (
            <>
              <Text style={[styles.memberDetail, { color: colors.textSecondary }]}>
                {' • '}
              </Text>
              <Text style={[styles.memberDetail, { color: colors.textSecondary }]}>
                {member.latency}ms
              </Text>
            </>
          )}
        </View>
      </View>
    </View>
  );

  // Only show loading if we don't have room data yet AND connection is in progress
  if (!room && connectionState === 'connecting') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.text }]}>
          连接中...
        </Text>
      </View>
    );
  }

  if (!room && connectionState === 'error') {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>
          连接失败
        </Text>
        <Button
          title="返回主页"
          onPress={() => navigation.navigate('Home')}
          style={{ marginTop: spacing.md }}
        />
      </View>
    );
  }

  // If we still don't have room data, show error
  if (!room) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>
          房间数据加载失败
        </Text>
        <Button
          title="返回主页"
          onPress={() => navigation.navigate('Home')}
          style={{ marginTop: spacing.md }}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={[styles.backButtonText, { color: colors.primary }]}>
            ← 返回
          </Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>房间</Text>
          <ConnectionStatus size="small" showLabel={false} />
        </View>
        <TouchableOpacity onPress={handleLeaveRoom} style={styles.leaveButton}>
          <Text style={[styles.leaveButtonText, { color: colors.error }]}>
            离开
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={[styles.contentContainer, { paddingBottom: 80 }]}>
        {/* Room Info Card */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            房间信息
          </Text>
          
          <View style={styles.roomCodeContainer}>
            <Text style={[styles.roomCodeLabel, { color: colors.textSecondary }]}>
              房间代码
            </Text>
            <Text style={[styles.roomCode, { color: colors.primary }]}>
              {roomId}
            </Text>
          </View>

          <Text style={[styles.hint, { color: colors.textSecondary }]}>
            分享此代码给朋友，让他们加入房间
          </Text>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {room?.members.length || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                成员
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {room?.playlist.length || 0}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                歌曲
              </Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.text }]}>
                {room?.syncState.status === 'playing' ? '播放中' : '暂停'}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                状态
              </Text>
            </View>
          </View>
        </View>

        {/* Current Track Info */}
        {currentTrack && (
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              正在播放
            </Text>
            
            <View style={styles.trackInfoCard}>
              {currentTrack.coverUrl ? (
                <Image
                  source={{ uri: currentTrack.coverUrl }}
                  style={styles.trackCover}
                />
              ) : (
                <View style={[styles.trackCover, styles.placeholderCover, { backgroundColor: colors.border }]}>
                  <Text style={{ color: colors.textSecondary, fontSize: 24 }}>♪</Text>
                </View>
              )}
              
              <View style={styles.trackDetails}>
                <Text style={[styles.trackTitle, { color: colors.text }]} numberOfLines={2}>
                  {currentTrack.title}
                </Text>
                <Text style={[styles.trackArtist, { color: colors.textSecondary }]} numberOfLines={1}>
                  {currentTrack.artist}
                </Text>
                <Text style={[styles.trackStatus, { color: isPlaying ? colors.primary : colors.textSecondary }]}>
                  {isPlaying ? '▶ 播放中' : '⏸ 已暂停'} · {Math.floor(position)}s / {currentTrack.duration}s
                </Text>
              </View>
            </View>

            <Button
              title="打开播放器"
              onPress={handleGoToPlayer}
              style={styles.openPlayerButton}
            />
          </View>
        )}

        {/* Members List */}
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            成员列表 ({room?.members.length || 0})
          </Text>

          {room && room.members.length > 0 ? (
            room.members.map((member) =>
              renderMemberItem(member, member.userId === room.hostId)
            )
          ) : (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              暂无成员
            </Text>
          )}
        </View>

        {/* Actions */}
        <Button
          title="搜索音乐"
          onPress={handleGoToPlayer}
          style={styles.actionButton}
        />
      </ScrollView>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
    width: 80,
  },
  backButtonText: {
    fontSize: 16,
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  leaveButton: {
    padding: 4,
    width: 80,
    alignItems: 'flex-end',
  },
  leaveButtonText: {
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 100,
    fontSize: 16,
  },
  errorText: {
    textAlign: 'center',
    marginTop: 100,
    fontSize: 16,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  roomCodeContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  roomCodeLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  roomCode: {
    fontSize: 32,
    fontWeight: 'bold',
    letterSpacing: 4,
  },
  hint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
  },
  memberItem: {
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
  memberInfo: {
    flex: 1,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  hostBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hostBadgeText: {
    fontSize: 10,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  memberDetails: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberDetail: {
    fontSize: 12,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 16,
  },
  trackInfoCard: {
    flexDirection: 'row',
    marginTop: 12,
    marginBottom: 12,
  },
  trackCover: {
    width: 80,
    height: 80,
    borderRadius: 8,
    marginRight: 12,
  },
  placeholderCover: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  trackDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  trackTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  trackArtist: {
    fontSize: 14,
    marginBottom: 4,
  },
  trackStatus: {
    fontSize: 12,
  },
  openPlayerButton: {
    marginTop: 8,
  },
  actionButton: {
    marginTop: 8,
    marginBottom: 32,
  },
});
