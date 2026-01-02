// app/src/services/storage/EQPresetStorage.ts
// EQ preset storage using AsyncStorage

import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS, BUILTIN_EQ_PRESETS } from '@shared/constants';
import type { EQPreset } from '@shared/types/entities';

/**
 * EQ Preset Storage Service
 * Manages custom and built-in EQ presets
 */
export class EQPresetStorage {
  /**
   * Get all EQ presets (built-in + custom)
   */
  async getAllPresets(): Promise<EQPreset[]> {
    try {
      const customPresets = await this.getCustomPresets();
      // Combine built-in and custom presets
      return [...BUILTIN_EQ_PRESETS as any[], ...customPresets];
    } catch (error) {
      console.error('[EQPresetStorage] Get all presets error:', error);
      return [...BUILTIN_EQ_PRESETS] as any[];
    }
  }

  /**
   * Get custom presets only
   */
  async getCustomPresets(): Promise<EQPreset[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOM_EQ_PRESETS);
      if (!data) {
        return [];
      }

      const presets: EQPreset[] = JSON.parse(data);
      return presets;
    } catch (error) {
      console.error('[EQPresetStorage] Get custom presets error:', error);
      return [];
    }
  }

  /**
   * Get a specific preset by ID
   */
  async getPreset(presetId: string): Promise<EQPreset | null> {
    try {
      // Check built-in presets first
      const builtIn = BUILTIN_EQ_PRESETS.find((p) => p.presetId === presetId);
      if (builtIn) {
        return builtIn as any;
      }

      // Check custom presets
      const customPresets = await this.getCustomPresets();
      const custom = customPresets.find((p) => p.presetId === presetId);
      return custom || null;
    } catch (error) {
      console.error('[EQPresetStorage] Get preset error:', error);
      return null;
    }
  }

  /**
   * Save a custom preset
   */
  async savePreset(preset: EQPreset): Promise<void> {
    if (preset.isBuiltIn) {
      throw new Error('Cannot modify built-in presets');
    }

    try {
      const customPresets = await this.getCustomPresets();
      
      // Check if preset already exists
      const existingIndex = customPresets.findIndex((p) => p.presetId === preset.presetId);
      
      if (existingIndex >= 0) {
        // Update existing
        customPresets[existingIndex] = preset;
      } else {
        // Add new
        customPresets.push(preset);
      }

      await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_EQ_PRESETS, JSON.stringify(customPresets));
      console.log('[EQPresetStorage] Saved preset:', preset.name);
    } catch (error) {
      console.error('[EQPresetStorage] Save preset error:', error);
      throw error;
    }
  }

  /**
   * Delete a custom preset
   */
  async deletePreset(presetId: string): Promise<void> {
    try {
      const customPresets = await this.getCustomPresets();
      
      // Check if it's a built-in preset
      const isBuiltIn = BUILTIN_EQ_PRESETS.some((p) => p.presetId === presetId);
      if (isBuiltIn) {
        throw new Error('Cannot delete built-in presets');
      }

      // Filter out the preset
      const filtered = customPresets.filter((p) => p.presetId !== presetId);

      await AsyncStorage.setItem(STORAGE_KEYS.CUSTOM_EQ_PRESETS, JSON.stringify(filtered));
      console.log('[EQPresetStorage] Deleted preset:', presetId);
    } catch (error) {
      console.error('[EQPresetStorage] Delete preset error:', error);
      throw error;
    }
  }

  /**
   * Check if a preset name already exists
   */
  async presetNameExists(name: string, excludePresetId?: string): Promise<boolean> {
    try {
      const allPresets = await this.getAllPresets();
      return allPresets.some(
        (p) => p.name.toLowerCase() === name.toLowerCase() && p.presetId !== excludePresetId
      );
    } catch (error) {
      console.error('[EQPresetStorage] Check preset name error:', error);
      return false;
    }
  }

  /**
   * Generate a unique preset ID
   */
  generatePresetId(): string {
    return `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Clear all custom presets
   */
  async clearCustomPresets(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.CUSTOM_EQ_PRESETS);
      console.log('[EQPresetStorage] Cleared all custom presets');
    } catch (error) {
      console.error('[EQPresetStorage] Clear custom presets error:', error);
      throw error;
    }
  }
}

// Singleton instance
export const eqPresetStorage = new EQPresetStorage();
