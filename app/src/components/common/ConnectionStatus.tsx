// app/src/components/common/ConnectionStatus.tsx
// Connection status indicator component

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { socketManager, ConnectionState } from '../../services/sync/SocketManager';
import { useTheme } from '../../hooks/useTheme';

interface ConnectionStatusProps {
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  showLabel = true,
  size = 'medium',
}) => {
  const { colors } = useTheme();
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    socketManager.getConnectionState()
  );

  useEffect(() => {
    // Subscribe to connection state changes
    const unsubscribe = socketManager.onStateChange(setConnectionState);

    return () => {
      unsubscribe();
    };
  }, []);

  const getStatusConfig = () => {
    switch (connectionState) {
      case 'connected':
        return {
          color: '#4CAF50',
          label: '已连接',
          icon: '🟢',
        };
      case 'connecting':
        return {
          color: '#FF9800',
          label: '连接中...',
          icon: '🟡',
        };
      case 'disconnected':
        return {
          color: '#9E9E9E',
          label: '未连接',
          icon: '⚪',
        };
      case 'error':
        return {
          color: colors.error,
          label: '连接失败',
          icon: '🔴',
        };
    }
  };

  const config = getStatusConfig();
  const dotSize = size === 'small' ? 8 : size === 'medium' ? 10 : 12;
  const fontSize = size === 'small' ? 12 : size === 'medium' ? 14 : 16;

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.dot,
          {
            width: dotSize,
            height: dotSize,
            backgroundColor: config.color,
          },
        ]}
      />
      {showLabel && (
        <Text
          style={[
            styles.label,
            {
              color: colors.textSecondary,
              fontSize,
            },
          ]}
        >
          {config.label}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    borderRadius: 999,
  },
  label: {
    fontWeight: '500',
  },
});
