// app/src/components/common/NetworkBanner.tsx
// Network disconnection banner with auto-reconnection feedback

import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { socketManager } from '../../services/sync/SocketManager';
import { useTheme } from '../../hooks/useTheme';

export function NetworkBanner() {
  const { showBanner, isOffline, isReconnecting, isConnectionError, reconnectInfo } = useNetworkStatus();
  const theme = useTheme();
  const slideAnim = useRef(new Animated.Value(-100)).current;

  // Animate banner in/out
  useEffect(() => {
    if (showBanner) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 7,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [showBanner, slideAnim]);

  if (!showBanner) {
    return null;
  }

  // Determine banner text and color
  let bannerText = '';
  let backgroundColor = '';

  if (isConnectionError) {
    bannerText = `连接失败 (${reconnectInfo.attempt}/${reconnectInfo.maxAttempts})`;
    backgroundColor = '#F44336'; // Red
  } else if (isOffline) {
    bannerText = '网络已断开，正在重连...';
    backgroundColor = '#F44336'; // Red
  } else if (isReconnecting) {
    const nextRetrySec = Math.ceil(reconnectInfo.nextRetryMs / 1000);
    bannerText = `正在重连 (${reconnectInfo.attempt}/${reconnectInfo.maxAttempts})，${nextRetrySec}s 后重试`;
    backgroundColor = '#FF9800'; // Orange/Yellow
  }

  const handleManualRetry = () => {
    console.log('[NetworkBanner] Manual retry triggered');
    socketManager.resetReconnectCount();
    socketManager.connect();
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <Text style={styles.text}>{bannerText}</Text>
      {isConnectionError && (
        <TouchableOpacity style={styles.retryButton} onPress={handleManualRetry}>
          <Text style={styles.retryButtonText}>重新连接</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    elevation: 10,
  },
  text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    flex: 1,
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginLeft: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
