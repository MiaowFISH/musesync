// app/src/navigation/AppNavigator.tsx
// React Navigation setup with stack navigator

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { Track } from '@shared/types/entities';

// Import screens (placeholders for now)
import { HomeScreen } from '../screens/HomeScreen';
import { RoomScreen } from '../screens/RoomScreen';
import PlayerScreen from '../screens/PlayerScreen';
import SearchScreen from '../screens/SearchScreen';
import { EQScreen } from '../screens/EQScreen';

export type RootStackParamList = {
  Home: undefined;
  Room: { roomId: string };
  Player: { trackId: string; track?: any };
  Search: undefined;
  EQ: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  return (
    <NavigationContainer>
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
        <Stack.Screen name="Search" component={SearchScreen} />
        <Stack.Screen name="EQ" component={EQScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
