// app/App.tsx
// Main app entry point

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppNavigator } from './src/navigation/AppNavigator';
import { StoreProvider } from './src/stores';

export default function App() {
  return (
    <StoreProvider>
      <StatusBar style="auto" />
      <AppNavigator />
    </StoreProvider>
  );
}
