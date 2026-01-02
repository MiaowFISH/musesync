// app/src/screens/HomeScreen.tsx
// Home screen - entry point

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { useTheme } from '../hooks/useTheme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { socketManager } from '../services/sync/SocketManager';
import { roomService } from '../services/sync/RoomService';
import { toast } from '../components/common/Toast';
import { ConnectionStatus } from '../components/common/ConnectionStatus';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

// Generate device ID (would normally be from device UUID)
const getDeviceId = () => {
  return `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const HomeScreen: React.FC = () => {
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const [roomCode, setRoomCode] = useState('');
  const [username, setUsername] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // Connect to server on mount
  useEffect(() => {
    const socket = socketManager.connect();
    
    return () => {
      // Clean up on unmount if needed
    };
  }, []);

  // Connect to server on mount
  useEffect(() => {
    const socket = socketManager.connect();
    
    return () => {
      // Clean up on unmount if needed
    };
  }, []);

  const handleCreateRoom = async () => {
    if (!username.trim()) {
      toast.error('请输入用户名');
      return;
    }

    if (!socketManager.isConnected()) {
      toast.error('未连接到服务器，请检查网络和API设置');
      return;
    }

    setIsCreating(true);
    try {
      const userId = getDeviceId();
      const result = await roomService.createRoom({
        userId,
        username: username.trim(),
        deviceId: getDeviceId(),
        deviceType: Platform.OS === 'web' ? 'web' : Platform.OS === 'ios' ? 'ios' : 'android',
      });

      if (result.success && result.room) {
        toast.success(`房间已创建: ${result.room.roomId}`);
        navigation.navigate('Room', { 
          roomId: result.room.roomId, 
          room: result.room,
          userId 
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

    setIsJoining(true);
    try {
      const userId = getDeviceId();
      const result = await roomService.joinRoom({
        roomId: roomCode,
        userId,
        username: username.trim(),
        deviceId: getDeviceId(),
        deviceType: Platform.OS === 'web' ? 'web' : Platform.OS === 'ios' ? 'ios' : 'android',
      });

      if (result.success && result.room) {
        toast.success(`已加入房间: ${result.room.roomId}`);
        navigation.navigate('Room', { 
          roomId: result.room.roomId, 
          room: result.room,
          userId 
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

  return (
    <ScrollView 
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
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
      </Card>

      <Card style={styles.card}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>单人模式</Text>
        <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
          搜索并播放音乐，调节EQ音效
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
  footer: {
    marginTop: 40,
    marginBottom: 20,
  },
  footerText: {
    fontSize: 12,
  },
});
