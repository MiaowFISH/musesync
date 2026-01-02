import { registerRootComponent } from 'expo';
import { Platform, AppRegistry } from 'react-native';
import TrackPlayer from 'react-native-track-player';

import App from './App';
import { TrackPlayerService } from './src/services/audio/TrackPlayerService';

// Register TrackPlayer service for native platforms only
if (Platform.OS !== 'web') {
  TrackPlayer.registerPlaybackService(() => TrackPlayerService);
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
