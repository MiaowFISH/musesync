// app/src/navigation/AppNavigator.tsx
// React Navigation setup with stack navigator

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { Track, Room } from '@shared/types/entities';

// Import screens (placeholders for now)
import { HomeScreen } from '../screens/HomeScreen';
import { RoomScreen } from '../screens/RoomScreen';
import PlayerScreen from '../screens/PlayerScreen';
import QueueScreen from '../screens/QueueScreen';
import SearchScreen from '../screens/SearchScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { MiniPlayer } from '../components/player/MiniPlayer';

export type RootStackParamList = {
  Home: undefined;
  Room: { roomId: string; room?: Room; userId?: string };
  Player: { trackId: string; track?: Track };
  Queue: undefined;
  Search: undefined;
  History: undefined;
  Settings: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  const [currentRoute, setCurrentRoute] = React.useState<string>('Home');

  return (
    <NavigationContainer
      onStateChange={(state) => {
        // Track current route to hide MiniPlayer on Player screen
        const route = state?.routes[state.index];
        if (route) {
          setCurrentRoute(route.name);
        }
      }}
    >
      <View style={styles.container}>
        <Stack.Navigator
          initialRouteName="Home"
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Room" component={RoomScreen} />
          <Stack.Screen name="Player" component={PlayerScreen} />
          <Stack.Screen name="Queue" component={QueueScreen} />
          <Stack.Screen name="Search" component={SearchScreen} />
          <Stack.Screen name="History" component={HistoryScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
        </Stack.Navigator>
        
        {/* Show MiniPlayer on all screens except Player */}
        {currentRoute !== 'Player' && <MiniPlayer />}
      </View>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
