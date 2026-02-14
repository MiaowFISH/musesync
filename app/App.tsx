// app/App.tsx
// Main app entry point

import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './src/navigation/AppNavigator';
import { StoreProvider } from './src/stores';
import { ToastContainer } from './src/components/common/Toast';
import { NetworkBanner } from './src/components/common/NetworkBanner';
import { networkMonitor } from './src/services/sync/NetworkMonitor';

export default function App() {
  // Start network monitoring on app mount
  useEffect(() => {
    console.log('[App] Starting network monitor');
    networkMonitor.start();

    return () => {
      console.log('[App] Stopping network monitor');
      networkMonitor.stop();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StoreProvider>
        <StatusBar style="auto" />
        <NetworkBanner />
        <AppNavigator />
        <ToastContainer />
      </StoreProvider>
    </GestureHandlerRootView>
  );
}
