// app/src/hooks/useTheme.ts
// Theme hook for accessing current theme with persistence

import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { theme, type Theme } from '../constants/theme';
import { usePreferencesStore } from '../stores';
import { preferencesStorage } from '../services/storage/PreferencesStorage';

export const useTheme = (): Theme => {
  const systemColorScheme = useColorScheme();
  const preferences = usePreferencesStore((state) => state.preferences);

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
      if (preferences.theme !== savedTheme) {
        setPreferences({ ...preferences, theme: savedTheme });
      }
    };
    loadTheme();
  }, []);

  /**
   * Set theme and persist to storage
   */
  const setTheme = async (newTheme: 'light' | 'dark' | 'system') => {
    await preferencesStorage.setTheme(newTheme);
    setPreferences({ ...preferences, theme: newTheme });
  };

  const effectiveTheme =
    preferences.theme === 'system' ? systemColorScheme || 'dark' : preferences.theme;

  return {
    theme: preferences.theme,
    effectiveTheme,
    setTheme,
    themeColors: theme[effectiveTheme],
  };
};
