// app/src/hooks/useTheme.ts
// Theme hook for accessing current theme

import { useColorScheme } from 'react-native';
import { theme, type Theme } from '../constants/theme';
import { usePreferencesStore } from '../stores';

export const useTheme = (): Theme => {
  const systemColorScheme = useColorScheme();
  const preferences = usePreferencesStore((state) => state.preferences);

  const themeMode = preferences?.theme || 'system';
  const effectiveMode =
    themeMode === 'system' ? systemColorScheme || 'dark' : themeMode;

  return theme[effectiveMode];
};
