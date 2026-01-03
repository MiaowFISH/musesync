import 'tsx/cjs';
import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'MusicTogether',
  slug: 'musictogether',
  version: '0.1.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  //   splash: {
  //     image: './assets/splash-icon.png',
  //     resizeMode: 'contain',
  //     backgroundColor: '#1a1a2e',
  //   },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.musictogether.app',
    infoPlist: {
      UIBackgroundModes: ['audio'],
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#1a1a2e',
    },
    package: 'com.musictogether.app',
    permissions: ['FOREGROUND_SERVICE'],
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    // './expo-plugins/withAndroidManifest',
    './expo-plugins/withAppBuildGradle',
    './expo-plugins/withGradleProperties',
    './expo-plugins/withProjectBuildGradle',
  ],
});
