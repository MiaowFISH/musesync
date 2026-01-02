// app/src/screens/HomeScreen.tsx
// Home screen - entry point

import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { useTheme } from '../hooks/useTheme';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC = () => {
  const { colors, spacing } = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const [roomCode, setRoomCode] = useState('');

  const handleCreateRoom = () => {
    // Generate random 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    navigation.navigate('Room', { roomId: code });
  };

  const handleJoinRoom = () => {
    if (roomCode.length === 6) {
      navigation.navigate('Room', { roomId: roomCode });
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
        <Button 
          title="创建房间" 
          onPress={handleCreateRoom}
          style={{ marginTop: spacing.md }}
        />
      </Card>

      <Card style={styles.card}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>加入房间</Text>
        <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
          输入6位房间代码加入房间
        </Text>
        <Input
          placeholder="输入房间代码"
          value={roomCode}
          onChangeText={setRoomCode}
          keyboardType="number-pad"
          maxLength={6}
          containerStyle={{ marginTop: spacing.md }}
        />
        <Button 
          title="加入房间" 
          onPress={handleJoinRoom}
          disabled={roomCode.length !== 6}
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
