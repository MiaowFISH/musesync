// app/App.tsx
// Main app entry point

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppNavigator } from './src/navigation/AppNavigator';
import { StoreProvider } from './src/stores';
import { ToastContainer } from './src/components/common/Toast';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StoreProvider>
        <StatusBar style="auto" />
        <AppNavigator />
        <ToastContainer />
      </StoreProvider>
    </GestureHandlerRootView>
  );
}
