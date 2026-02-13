// app/src/hooks/useTheme.ts
// Theme hook for accessing current theme with persistence

import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { theme, type Theme } from '../constants/theme';
import { usePreferencesStore } from '../stores';
import { preferencesStorage } from '../services/storage/PreferencesStorage';

export const useTheme = (): Theme => {
  const systemColorScheme = useColorScheme();
  const preferences = usePreferencesStore().preferences;

  const themeMode = preferences?.theme || 'system';
  const effectiveMode =
    themeMode === 'system' ? systemColorScheme || 'dark' : themeMode;

  return theme[effectiveMode];
};

/**
 * Hook for theme management with persistence
 */
export const useThemeManager = () => {
  const { preferences, setPreferences } = usePreferencesStore();
  const systemColorScheme = useColorScheme();

  // Load theme from storage on mount
  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = await preferencesStorage.getTheme();
      if (!preferences || preferences.theme !== savedTheme) {
        const defaultPreferences: typeof preferences = {
          theme: 'system',
          playbackHistory: [],
          recentRooms: [],
          username: '',
          audioQualityPreference: 'auto',
        };
        setPreferences({
          ...(preferences || defaultPreferences),
          theme: savedTheme
        });
      }
    };
    loadTheme();
  }, [preferences, setPreferences]);

  /**
   * Set theme and persist to storage
   */
  const setTheme = async (newTheme: 'light' | 'dark' | 'system') => {
    await preferencesStorage.setTheme(newTheme);
    const defaultPreferences: typeof preferences = {
      theme: 'system',
      playbackHistory: [],
      recentRooms: [],
      username: '',
      audioQualityPreference: 'auto',
    };
    setPreferences({
      ...(preferences || defaultPreferences),
      theme: newTheme
    });
  };

  const currentTheme = preferences?.theme || 'system';
  const effectiveTheme =
    currentTheme === 'system' ? systemColorScheme || 'dark' : currentTheme;

  return {
    theme: currentTheme,
    effectiveTheme,
    setTheme,
    themeColors: theme[effectiveTheme],
  };
};
