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
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import type { Room, User } from '@shared/types/entities';
import { socketManager } from '../services/sync/SocketManager';
import { roomService } from '../services/sync/RoomService';
import { toast } from '../components/common/Toast';
import { Button } from '../components/ui/Button';
import { ConnectionStatus } from '../components/common/ConnectionStatus';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Room'>;
type RoomRouteProp = RouteProp<RootStackParamList, 'Room'>;

export const RoomScreen: React.FC = () => {
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoomRouteProp>();
  const { roomId, room: initialRoom, userId } = route.params;

  const [room, setRoom] = useState<Room | null>(initialRoom || null);
  const [connectionState, setConnectionState] = useState<'connecting' | 'connected' | 'error'>('connecting');

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
      socket.on('member:joined', (data: any) => {
        console.log('[RoomScreen] Member joined:', data);
        if (data.room) {
          setRoom(data.room);
        }
        toast.success(`${data.username} 加入了房间`);
      });

      // Member left event
      socket.on('member:left', (data: any) => {
        console.log('[RoomScreen] Member left:', data);
        if (data.room) {
          setRoom(data.room);
        }
        
        if (data.newHostId) {
          toast.info('主持人已离开，管理权已转移');
        } else {
          toast.info('有成员离开了房间');
        }
      });

      // Sync state update
      socket.on('sync:state', (data: any) => {
        console.log('[RoomScreen] Sync state updated:', data);
        if (data.state && room) {
          setRoom({
            ...room,
            syncState: data.state,
          });
        }
      });

      // Room error (e.g., room not found after reconnection)
      socket.on('error', (data: any) => {
        console.error('[RoomScreen] Socket error:', data);
        if (data.message?.includes('not found') || data.message?.includes('不存在')) {
          toast.error('房间已失效，请重新创建');
          navigation.navigate('Home');
        }
      });
    }

    return () => {
      unsubscribe();
      if (socket) {
        socket.off('member:joined');
        socket.off('member:left');
        socket.off('sync:state');
        socket.off('error');
      }
    };
  }, [room, navigation]);

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
        toast.success('已离开房间');
      }
      navigation.navigate('Home');
    } catch (error) {
      console.error('[RoomScreen] Leave room error:', error);
      toast.error('离开房间失败');
      // Still navigate home even if leave fails
      navigation.navigate('Home');
    }
  };

  const handleGoToPlayer = () => {
    navigation.navigate('Search');
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

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
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
  actionButton: {
    marginTop: 8,
    marginBottom: 32,
  },
});
