// app/src/hooks/useNetworkStatus.ts
// React hook exposing network status and socket connection state

import { useState, useEffect } from 'react';
import { networkMonitor, NetworkStatus } from '../services/sync/NetworkMonitor';
import { socketManager, ConnectionState, ReconnectInfo } from '../services/sync/SocketManager';

export interface NetworkStatusHook {
  isOffline: boolean;
  isReconnecting: boolean;
  isConnectionError: boolean;
  showBanner: boolean;
  networkStatus: NetworkStatus;
  connectionState: ConnectionState;
  reconnectInfo: ReconnectInfo;
}

/**
 * Hook to monitor network and socket connection status
 */
export function useNetworkStatus(): NetworkStatusHook {
  const [networkStatus, setNetworkStatus] = useState<NetworkStatus>(networkMonitor.getStatus());
  const [connectionState, setConnectionState] = useState<ConnectionState>(socketManager.getConnectionState());
  const [reconnectInfo, setReconnectInfo] = useState<ReconnectInfo>(socketManager.getReconnectInfo());

  // Subscribe to network status changes
  useEffect(() => {
    const unsubscribe = networkMonitor.onStatusChange((status) => {
      setNetworkStatus(status);
    });

    return unsubscribe;
  }, []);

  // Subscribe to socket connection state changes
  useEffect(() => {
    const unsubscribe = socketManager.onStateChange((state) => {
      setConnectionState(state);
    });

    return unsubscribe;
  }, []);

  // Subscribe to reconnect info changes
  useEffect(() => {
    const unsubscribe = socketManager.onReconnectInfoChange((info) => {
      setReconnectInfo(info);
    });

    return unsubscribe;
  }, []);

  // Derived state
  const isOffline = !networkStatus.isConnected;
  const isReconnecting = connectionState === 'reconnecting';
  const isConnectionError = connectionState === 'error';
  const showBanner = isOffline || isReconnecting || isConnectionError;

  return {
    isOffline,
    isReconnecting,
    isConnectionError,
    showBanner,
    networkStatus,
    connectionState,
    reconnectInfo,
  };
}
