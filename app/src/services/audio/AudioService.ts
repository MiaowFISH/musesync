// app/src/services/audio/AudioService.ts
// Unified audio service that switches between Web and Native implementations

import { Platform } from 'react-native';
import type { Track } from '@shared/types/entities';
import { WebAudioService } from './WebAudioService';
import { NativeAudioService } from './NativeAudioService';

/**
 * Unified Audio Service Interface
 * Automatically selects the appropriate implementation based on platform
 */
export class AudioService {
  private implementation: WebAudioService | NativeAudioService;

  constructor() {
    // Select implementation based on platform
    if (Platform.OS === 'web') {
      this.implementation = new WebAudioService();
      console.log('[AudioService] Using WebAudioService for web platform');
    } else {
      this.implementation = new NativeAudioService();
      console.log('[AudioService] Using NativeAudioService for native platform');
    }
  }

  /**
   * Initialize audio service
   * Must be called before using any player functions
   */
  async initialize(): Promise<void> {
    return this.implementation.initialize();
  }

  /**
   * Load and play a track
   */
  async play(track: Track, audioUrl: string): Promise<void> {
    return this.implementation.play(track, audioUrl);
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (Platform.OS === 'web') {
      this.implementation.pause();
    } else {
      // Native implementation is async but we keep interface sync for compatibility
      (this.implementation as NativeAudioService).pause();
    }
  }

  /**
   * Resume playback
   */
  async resume(): Promise<void> {
    return this.implementation.resume();
  }

  /**
   * Seek to position (seconds)
   */
  seek(positionSeconds: number): void {
    if (Platform.OS === 'web') {
      this.implementation.seek(positionSeconds);
    } else {
      // Native implementation is async but we keep interface sync for compatibility
      (this.implementation as NativeAudioService).seek(positionSeconds);
    }
  }

  /**
   * Get current position (seconds)
   * Note: For native platforms, this returns the last known position
   * For real-time position, use the progress callback
   */
  getPosition(): number {
    if (Platform.OS === 'web') {
      return (this.implementation as WebAudioService).getPosition();
    } else {
      // Native getPosition is async, so we return 0 and rely on progress callbacks
      // For actual position, the app should use the onProgress callback
      return 0;
    }
  }

  /**
   * Get duration (seconds)
   * Note: For native platforms, this returns 0
   * Duration should be obtained from track metadata
   */
  getDuration(): number {
    if (Platform.OS === 'web') {
      return (this.implementation as WebAudioService).getDuration();
    } else {
      // Native getDuration is async, return 0 and use track.duration instead
      return 0;
    }
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void {
    if (Platform.OS === 'web') {
      this.implementation.setVolume(volume);
    } else {
      // Native implementation is async but we keep interface sync for compatibility
      (this.implementation as NativeAudioService).setVolume(volume);
    }
  }

  /**
   * Set playback rate (for sync)
   */
  setPlaybackRate(rate: number): void {
    if (Platform.OS === 'web') {
      this.implementation.setPlaybackRate(rate);
    } else {
      // Native implementation is async but we keep interface sync for compatibility
      (this.implementation as NativeAudioService).setPlaybackRate(rate);
    }
  }

  /**
   * Get playback rate
   */
  getPlaybackRate(): number {
    return this.implementation.getPlaybackRate();
  }

  /**
   * Check if playing
   * Note: For native platforms, this is async internally but returns boolean for compatibility
   */
  isPlaying(): boolean {
    if (Platform.OS === 'web') {
      return (this.implementation as WebAudioService).isPlaying();
    } else {
      // Native isPlaying is async, so we return false
      // The app should track playing state through callbacks
      return false;
    }
  }

  /**
   * Get current track
   */
  getCurrentTrack(): Track | null {
    return this.implementation.getCurrentTrack();
  }

  /**
   * Set progress callback
   */
  onProgress(callback: (position: number) => void): void {
    this.implementation.onProgress(callback);
  }

  /**
   * Set end callback
   */
  onEnd(callback: () => void): void {
    this.implementation.onEnd(callback);
  }

  /**
   * Stop playback and reset
   */
  stop(): void {
    if (Platform.OS === 'web') {
      this.implementation.stop();
    } else {
      // Native implementation is async but we keep interface sync for compatibility
      (this.implementation as NativeAudioService).stop();
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (Platform.OS === 'web') {
      this.implementation.dispose();
    } else {
      // Native implementation is async but we keep interface sync for compatibility
      (this.implementation as NativeAudioService).dispose();
    }
  }
}

// Singleton instance
export const audioService = new AudioService();