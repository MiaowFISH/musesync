// app/src/services/storage/PreferencesStorage.ts
// Local preferences storage (theme, EQ settings, history)

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  THEME: '@musictogether:theme',
  EQ_SETTINGS: '@musictogether:eq_settings',
  LAST_PRESET: '@musictogether:last_preset',
  VOLUME: '@musictogether:volume',
  AUTO_PLAY: '@musictogether:auto_play',
} as const;

export interface PreferencesData {
  theme: 'light' | 'dark' | 'system';
  eqSettings?: {
    bands: number[]; // 10 bands gain values
    presetName: string;
  };
  volume: number; // 0-1
  autoPlay: boolean;
}

/**
 * Preferences Storage Service
 * Manages user preferences with AsyncStorage
 */
class PreferencesStorage {
  /**
   * Get theme preference
   */
  async getTheme(): Promise<'light' | 'dark' | 'system'> {
    try {
      const value = await AsyncStorage.getItem(KEYS.THEME);
      return (value as 'light' | 'dark' | 'system') || 'system';
    } catch (error) {
      console.error('[PreferencesStorage] Get theme error:', error);
      return 'system';
    }
  }

  /**
   * Set theme preference
   */
  async setTheme(theme: 'light' | 'dark' | 'system'): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.THEME, theme);
    } catch (error) {
      console.error('[PreferencesStorage] Set theme error:', error);
    }
  }

  /**
   * Get EQ settings
   */
  async getEQSettings(): Promise<{ bands: number[]; presetName: string } | null> {
    try {
      const value = await AsyncStorage.getItem(KEYS.EQ_SETTINGS);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('[PreferencesStorage] Get EQ settings error:', error);
      return null;
    }
  }

  /**
   * Set EQ settings
   */
  async setEQSettings(bands: number[], presetName: string): Promise<void> {
    try {
      const data = { bands, presetName };
      await AsyncStorage.setItem(KEYS.EQ_SETTINGS, JSON.stringify(data));
    } catch (error) {
      console.error('[PreferencesStorage] Set EQ settings error:', error);
    }
  }

  /**
   * Get volume preference
   */
  async getVolume(): Promise<number> {
    try {
      const value = await AsyncStorage.getItem(KEYS.VOLUME);
      return value ? parseFloat(value) : 1.0;
    } catch (error) {
      console.error('[PreferencesStorage] Get volume error:', error);
      return 1.0;
    }
  }

  /**
   * Set volume preference
   */
  async setVolume(volume: number): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.VOLUME, volume.toString());
    } catch (error) {
      console.error('[PreferencesStorage] Set volume error:', error);
    }
  }

  /**
   * Get auto-play preference
   */
  async getAutoPlay(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(KEYS.AUTO_PLAY);
      return value === 'true';
    } catch (error) {
      console.error('[PreferencesStorage] Get auto-play error:', error);
      return false;
    }
  }

  /**
   * Set auto-play preference
   */
  async setAutoPlay(enabled: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.AUTO_PLAY, enabled.toString());
    } catch (error) {
      console.error('[PreferencesStorage] Set auto-play error:', error);
    }
  }

  /**
   * Get all preferences
   */
  async getAll(): Promise<PreferencesData> {
    const [theme, eqSettings, volume, autoPlay] = await Promise.all([
      this.getTheme(),
      this.getEQSettings(),
      this.getVolume(),
      this.getAutoPlay(),
    ]);

    return {
      theme,
      eqSettings: eqSettings || undefined,
      volume,
      autoPlay,
    };
  }

  /**
   * Clear all preferences
   */
  async clear(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(Object.values(KEYS));
    } catch (error) {
      console.error('[PreferencesStorage] Clear error:', error);
    }
  }
}

// Singleton instance
export const preferencesStorage = new PreferencesStorage();
