// app/src/services/audio/EqualizerService.ts
// 10-band equalizer using Web Audio API BiquadFilterNodes

import { Platform } from 'react-native';
import { audioService } from './AudioService';
import { AUDIO_CONFIG } from '@shared/constants';
import type { EQPreset } from '@shared/types/entities';

/**
 * Equalizer Service
 * Implements 10-band EQ using Web Audio API
 */
export class EqualizerService {
  private filters: BiquadFilterNode[] = [];
  private audioContext: AudioContext | null = null;
  private enabled = false;
  private currentGains: number[] = Array(AUDIO_CONFIG.EQ_BANDS).fill(0);

  /**
   * Initialize EQ filters
   * Must be called after AudioService is initialized
   */
  async initialize(): Promise<void> {
    if (Platform.OS !== 'web') {
      console.warn('[EqualizerService] Web Audio API only available on web platform');
      return;
    }

    try {
      // Get audio context from audio service
      this.audioContext = audioService.getAudioContext();
      if (!this.audioContext) {
        throw new Error('Audio context not available. Initialize AudioService first.');
      }

      // Create 10 BiquadFilterNodes
      this.filters = AUDIO_CONFIG.EQ_FREQUENCIES.map((freq, index) => {
        const filter = this.audioContext!.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1.0;
        filter.gain.value = 0;
        return filter;
      });

      // Connect filters in chain
      // Get source and gain nodes from audio service
      const sourceNode = audioService.getSourceNode();
      const gainNode = audioService.getGainNode();

      if (!sourceNode || !gainNode) {
        throw new Error('Audio nodes not available');
      }

      // Disconnect existing connection
      sourceNode.disconnect();

      // Connect: source -> filter1 -> filter2 -> ... -> filter10 -> gain -> destination
      sourceNode.connect(this.filters[0]);
      for (let i = 0; i < this.filters.length - 1; i++) {
        this.filters[i].connect(this.filters[i + 1]);
      }
      this.filters[this.filters.length - 1].connect(gainNode);

      this.enabled = true;
      console.log('[EqualizerService] Initialized with 10 bands');
    } catch (error) {
      console.error('[EqualizerService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Set gain for a specific band
   * @param bandIndex 0-9
   * @param gainDb -12 to +12 dB
   */
  setBandGain(bandIndex: number, gainDb: number): void {
    if (bandIndex < 0 || bandIndex >= AUDIO_CONFIG.EQ_BANDS) {
      console.warn('[EqualizerService] Invalid band index:', bandIndex);
      return;
    }

    if (!this.enabled || !this.audioContext) {
      console.warn('[EqualizerService] EQ not initialized');
      return;
    }

    // Clamp gain to valid range
    const clampedGain = Math.max(
      AUDIO_CONFIG.EQ_MIN_GAIN,
      Math.min(AUDIO_CONFIG.EQ_MAX_GAIN, gainDb)
    );

    // Use setTargetAtTime for smooth transitions
    const filter = this.filters[bandIndex];
    const currentTime = this.audioContext.currentTime;
    filter.gain.setTargetAtTime(clampedGain, currentTime, 0.015); // 15ms time constant

    this.currentGains[bandIndex] = clampedGain;
    console.log(`[EqualizerService] Band ${bandIndex} (${AUDIO_CONFIG.EQ_FREQUENCIES[bandIndex]}Hz) set to ${clampedGain}dB`);
  }

  /**
   * Set all band gains at once
   * @param gains Array of 10 gain values (-12 to +12 dB)
   */
  setAllGains(gains: number[]): void {
    if (gains.length !== AUDIO_CONFIG.EQ_BANDS) {
      console.warn('[EqualizerService] Invalid gains array length:', gains.length);
      return;
    }

    gains.forEach((gain, index) => {
      this.setBandGain(index, gain);
    });
  }

  /**
   * Get current gain for a band
   */
  getBandGain(bandIndex: number): number {
    if (bandIndex < 0 || bandIndex >= AUDIO_CONFIG.EQ_BANDS) {
      return 0;
    }

    return this.currentGains[bandIndex];
  }

  /**
   * Get all current gains
   */
  getAllGains(): number[] {
    return [...this.currentGains];
  }

  /**
   * Load an EQ preset
   */
  loadPreset(preset: EQPreset): void {
    if (preset.bands.length !== AUDIO_CONFIG.EQ_BANDS) {
      console.warn('[EqualizerService] Invalid preset bands length:', preset.bands.length);
      return;
    }

    this.setAllGains(preset.bands);
    console.log('[EqualizerService] Loaded preset:', preset.name);
  }

  /**
   * Reset EQ to flat (all bands at 0dB)
   */
  reset(): void {
    const flatGains = Array(AUDIO_CONFIG.EQ_BANDS).fill(0);
    this.setAllGains(flatGains);
    console.log('[EqualizerService] Reset to flat');
  }

  /**
   * Enable/disable EQ
   */
  setEnabled(enabled: boolean): void {
    if (!this.audioContext) {
      console.warn('[EqualizerService] EQ not initialized');
      return;
    }

    this.enabled = enabled;

    if (enabled) {
      // Restore gains
      this.setAllGains(this.currentGains);
    } else {
      // Bypass by setting all gains to 0
      this.filters.forEach((filter) => {
        filter.gain.setTargetAtTime(0, this.audioContext!.currentTime, 0.015);
      });
    }

    console.log('[EqualizerService] Enabled:', enabled);
  }

  /**
   * Check if EQ is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get frequency for a band
   */
  getBandFrequency(bandIndex: number): number {
    if (bandIndex < 0 || bandIndex >= AUDIO_CONFIG.EQ_BANDS) {
      return 0;
    }

    return AUDIO_CONFIG.EQ_FREQUENCIES[bandIndex];
  }

  /**
   * Get all frequencies
   */
  getAllFrequencies(): readonly number[] {
    return AUDIO_CONFIG.EQ_FREQUENCIES;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.filters.length > 0) {
      // Disconnect all filters
      this.filters.forEach((filter) => {
        filter.disconnect();
      });
      this.filters = [];
    }

    this.audioContext = null;
    this.enabled = false;
    this.currentGains = Array(AUDIO_CONFIG.EQ_BANDS).fill(0);
  }
}

// Singleton instance
export const equalizerService = new EqualizerService();
