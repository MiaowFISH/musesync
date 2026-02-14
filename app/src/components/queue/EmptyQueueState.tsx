// app/src/components/queue/EmptyQueueState.tsx
// Empty queue placeholder UI

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface EmptyQueueStateProps {
  onAddSong: () => void;
}

export const EmptyQueueState: React.FC<EmptyQueueStateProps> = ({ onAddSong }) => {
  const theme = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[styles.icon, { color: theme.colors.textSecondary }]}>♪</Text>
      <Text style={[styles.title, { color: theme.colors.textSecondary }]}>队列为空</Text>
      <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
        添加歌曲开始播放
      </Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: theme.colors.primary }]}
        onPress={onAddSong}
        activeOpacity={0.8}
      >
        <Text style={[styles.buttonText, { color: theme.colors.background }]}>
          添加歌曲
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  icon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
