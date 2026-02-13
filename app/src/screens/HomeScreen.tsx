// app/src/screens/HomeScreen.tsx
// Home screen - entry point

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform, TouchableOpacity } from 'react-native';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { useTheme } from '../hooks/useTheme';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { socketManager, ensureInitialized } from '../services/sync/SocketManager';
import { roomService } from '../services/sync/RoomService';
import { toast } from '../components/common/Toast';
import { ConnectionStatus } from '../components/common/ConnectionStatus';
import { preferencesStorage } from '../services/storage/PreferencesStorage';
import { roomHistoryStorage, type RoomHistoryItem } from '../services/storage/RoomHistoryStorage';
import { useRoomStore } from '../stores';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC = () => {
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const roomStore = useRoomStore();
  const [roomCode, setRoomCode] = useState('');
  const [username, setUsername] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [createdRooms, setCreatedRooms] = useState<RoomHistoryItem[]>([]);
  const [joinedRooms, setJoinedRooms] = useState<RoomHistoryItem[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');

  // Load saved username, room history, and device ID on mount
  useEffect(() => {
    const loadData = async () => {
      const savedUsername = await preferencesStorage.getUsername();
      if (savedUsername) {
        setUsername(savedUsername);
      }
      const created = await roomHistoryStorage.getCreatedRooms();
      const joined = await roomHistoryStorage.getJoinedRooms();
      setCreatedRooms(created);
      setJoinedRooms(joined);
      
      // Get or generate device ID
      const id = await preferencesStorage.getDeviceId();
      setDeviceId(id);
      console.log('[HomeScreen] Device ID:', id);
    };
    loadData();
  }, []);

  // Reload room history when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const reloadHistory = async () => {
        const created = await roomHistoryStorage.getCreatedRooms();
        const joined = await roomHistoryStorage.getJoinedRooms();
        setCreatedRooms(created);
        setJoinedRooms(joined);
      };
      reloadHistory();
    }, [])
  );

  // Save username when it changes
  useEffect(() => {
    if (username.trim()) {
      preferencesStorage.setUsername(username.trim());
    }
  }, [username]);

  // Connect to server on mount - ensure initialization first
  useEffect(() => {
    const connectToServer = async () => {
      await ensureInitialized();
      const socket = socketManager.connect();
    };
    
    connectToServer();
    
    return () => {
      // Clean up on unmount if needed
    };
  }, []);

  const handleCreateRoom = async () => {
    if (roomStore.room) {
      toast.warning('您已在房间内，请先离开当前房间');
      return;
    }

    if (!username.trim()) {
      toast.error('请输入用户名');
      return;
    }

    if (!socketManager.isConnected()) {
      toast.error('未连接到服务器，请检查网络和API设置');
      return;
    }

    if (!deviceId) {
      toast.error('设备ID未初始化');
      return;
    }

    setIsCreating(true);
    try {
      const result = await roomService.createRoom({
        userId: deviceId,
        username: username.trim(),
        deviceId: deviceId,
        deviceType: Platform.OS === 'web' ? 'web' : Platform.OS === 'ios' ? 'ios' : 'android',
      });

      if (result.success && result.room) {
        // Save to created rooms history
        await roomHistoryStorage.addCreatedRoom({
          roomId: result.room.roomId,
          roomCode: result.room.roomId,
          timestamp: Date.now(),
          memberCount: result.room.members.length,
        });
        
        // Reload history to update UI
        const created = await roomHistoryStorage.getCreatedRooms();
        setCreatedRooms(created);
        
        toast.success(`房间已创建: ${result.room.roomId}`);
        navigation.navigate('Room', { 
          roomId: result.room.roomId, 
          room: result.room,
          userId: deviceId 
        });
      } else {
        toast.error(result.error || '创建房间失败');
      }
    } catch (error) {
      console.error('[HomeScreen] Create room error:', error);
      toast.error('创建房间失败');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async () => {
    if (roomStore.room) {
      toast.warning('您已在房间内，请先离开当前房间');
      return;
    }

    if (!username.trim()) {
      toast.error('请输入用户名');
      return;
    }

    if (roomCode.length !== 6) {
      toast.error('请输入6位房间代码');
      return;
    }

    if (!socketManager.isConnected()) {
      toast.error('未连接到服务器，请检查网络和API设置');
      return;
    }

    if (!deviceId) {
      toast.error('设备ID未初始化');
      return;
    }

    setIsJoining(true);
    try {
      const result = await roomService.joinRoom({
        roomId: roomCode,
        userId: deviceId,
        username: username.trim(),
        deviceId: deviceId,
        deviceType: Platform.OS === 'web' ? 'web' : Platform.OS === 'ios' ? 'ios' : 'android',
      });

      if (result.success && result.room) {
        // Save to joined rooms history
        await roomHistoryStorage.addJoinedRoom({
          roomId: result.room.roomId,
          roomCode: result.room.roomId,
          timestamp: Date.now(),
          memberCount: result.room.members.length,
        });
        
        // Reload history to update UI
        const joined = await roomHistoryStorage.getJoinedRooms();
        setJoinedRooms(joined);
        
        toast.success(`已加入房间: ${result.room.roomId}`);
        navigation.navigate('Room', { 
          roomId: result.room.roomId, 
          room: result.room,
          userId: deviceId 
        });
      } else {
        toast.error(result.error || '加入房间失败');
      }
    } catch (error) {
      console.error('[HomeScreen] Join room error:', error);
      toast.error('加入房间失败');
    } finally {
      setIsJoining(false);
    }
  };

  const handleSearch = () => {
    navigation.navigate('Search');
  };

  const handleHistory = () => {
    navigation.navigate('History');
  };

  const handleSettings = () => {
    navigation.navigate('Settings');
  };

  const handleRemoveCreatedRoom = async (roomId: string) => {
    await roomHistoryStorage.removeCreatedRoom(roomId);
    const created = await roomHistoryStorage.getCreatedRooms();
    setCreatedRooms(created);
  };

  const handleRemoveJoinedRoom = async (roomId: string) => {
    await roomHistoryStorage.removeJoinedRoom(roomId);
    const joined = await roomHistoryStorage.getJoinedRooms();
    setJoinedRooms(joined);
  };

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingBottom: 80 }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>🎵 Music Together</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          多设备实时同步音乐播放器
        </Text>
        
        <View style={styles.statusRow}>
          <ConnectionStatus size="small" />
        </View>
        
        <Button 
          title="⚙️ 设置" 
          onPress={handleSettings}
          style={{ marginTop: spacing.md }}
          variant="outline"
        />
      </View>

      {roomStore.room ? (
        <Card style={styles.card}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>当前房间</Text>
          <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
            您已在房间中
          </Text>
          <View style={styles.currentRoomInfo}>
            <Text style={[styles.currentRoomCode, { color: colors.primary }]}>
              房间代码: {roomStore.room.roomId}
            </Text>
            <Text style={[styles.currentRoomMembers, { color: colors.textSecondary }]}>
              {roomStore.room.members.length} 人在线
            </Text>
          </View>
          <Button 
            title="进入房间"
            onPress={() => navigation.navigate('Room', { 
              roomId: roomStore.room!.roomId, 
              room: roomStore.room!,
              userId: deviceId 
            })}
            style={{ marginTop: spacing.md }}
          />
        </Card>
      ) : (
        <>
          <Card style={styles.card}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>创建房间</Text>
            <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
              创建一个新房间，邀请朋友一起听歌
            </Text>
            <Input
              placeholder="输入用户名"
              value={username}
              onChangeText={setUsername}
              containerStyle={{ marginTop: spacing.md }}
            />
            <Button 
              title={isCreating ? '创建中...' : '创建房间'}
              onPress={handleCreateRoom}
              style={{ marginTop: spacing.sm }}
              disabled={isCreating || !username.trim()}
            />
            
            {/* Created rooms history */}
            {createdRooms.length > 0 && (
              <View style={styles.historySection}>
                <Text style={[styles.historyTitle, { color: colors.textSecondary }]}>
                  最近创建
                </Text>
                {createdRooms.slice(0, 3).map((room) => (
                  <View
                    key={room.roomId}
                    style={[styles.historyItem, { backgroundColor: colors.background }]}
                  >
                    <TouchableOpacity
                      style={styles.historyItemButton}
                      onPress={() => setRoomCode(room.roomCode)}
                    >
                      <Text style={[styles.historyRoomCode, { color: colors.text }]}>
                        {room.roomCode}
                      </Text>
                      <Text style={[styles.historyTimestamp, { color: colors.textSecondary }]}>
                        {new Date(room.timestamp).toLocaleDateString()}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.historyDeleteButton}
                      onPress={() => handleRemoveCreatedRoom(room.roomId)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={[styles.historyDeleteText, { color: colors.error }]}>
                        ✕
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </Card>

          <Card style={styles.card}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>加入房间</Text>
            <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
              输入用户名和6位房间代码加入房间
            </Text>
            <Input
              placeholder="输入用户名"
              value={username}
              onChangeText={setUsername}
              containerStyle={{ marginTop: spacing.md }}
            />
            <Input
              placeholder="输入房间代码"
              value={roomCode}
              onChangeText={setRoomCode}
              keyboardType="number-pad"
              maxLength={6}
              containerStyle={{ marginTop: spacing.sm }}
            />
            <Button 
              title={isJoining ? '加入中...' : '加入房间'}
              onPress={handleJoinRoom}
              disabled={isJoining || roomCode.length !== 6 || !username.trim()}
              style={{ marginTop: spacing.sm }}
              variant="secondary"
            />
            
            {/* Joined rooms history */}
            {joinedRooms.length > 0 && (
              <View style={styles.historySection}>
                <Text style={[styles.historyTitle, { color: colors.textSecondary }]}>
                  最近加入
                </Text>
                {joinedRooms.slice(0, 3).map((room) => (
                  <View
                    key={room.roomId}
                    style={[styles.historyItem, { backgroundColor: colors.background }]}
                  >
                    <TouchableOpacity
                      style={styles.historyItemButton}
                      onPress={() => setRoomCode(room.roomCode)}
                    >
                      <Text style={[styles.historyRoomCode, { color: colors.text }]}>
                        {room.roomCode}
                      </Text>
                      <Text style={[styles.historyTimestamp, { color: colors.textSecondary }]}>
                        {new Date(room.timestamp).toLocaleDateString()}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.historyDeleteButton}
                      onPress={() => handleRemoveJoinedRoom(room.roomId)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={[styles.historyDeleteText, { color: colors.error }]}>
                        ✕
                      </Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </Card>
        </>
      )}

      <Card style={styles.card}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>单人模式</Text>
        <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
          搜索并播放音乐
        </Text>
        <Button 
          title="搜索音乐" 
          onPress={handleSearch}
          style={{ marginTop: spacing.md }}
          variant="outline"
        />
        <Button 
          title="播放历史" 
          onPress={handleHistory}
          style={{ marginTop: spacing.sm }}
          variant="outline"
        />
      </Card>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: colors.textSecondary }]}>
          v0.1.0 • Development Build
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginVertical: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  statusRow: {
    marginTop: 16,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  historySection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.2)',
  },
  historyTitle: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  historyItemButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyRoomCode: {
    fontSize: 16,
    fontWeight: '600',
  },
  historyTimestamp: {
    fontSize: 12,
  },
  historyDeleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  historyDeleteText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  currentRoomInfo: {
    marginTop: 16,
    padding: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
  },
  currentRoomCode: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  currentRoomMembers: {
    fontSize: 14,
  },
  footer: {
    marginTop: 40,
    marginBottom: 20,
  },
  footerText: {
    fontSize: 12,
  },
});
