// app/src/services/audio/AudioService.ts
// Web Audio API service for Web platform (React Native Web compatible)

import { Platform } from 'react-native';
import type { Track } from '@shared/types/entities';
import { AUDIO_CONFIG } from '@shared/constants';

/**
 * Audio Service for Web platform
 * Uses Web Audio API with MediaElement for playback
 */
export class AudioService {
  private audioElement: HTMLAudioElement | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private currentTrack: Track | null = null;
  private progressInterval: NodeJS.Timeout | null = null;
  private onProgressCallback: ((position: number) => void) | null = null;
  private onEndCallback: (() => void) | null = null;
  private isInitialized = false;

  /**
   * Initialize Web Audio API
   * Must be called after user gesture (e.g., on first play button click)
   */
  async initialize(): Promise<void> {
    if (Platform.OS !== 'web') {
      console.warn('[AudioService] Web Audio API only available on web platform');
      return;
    }

    if (this.isInitialized) {
      return;
    }

    try {
      // Create audio element
      this.audioElement = document.createElement('audio');
      this.audioElement.crossOrigin = 'anonymous';
      
      // Setup audio context
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create source node from audio element
      this.sourceNode = this.audioContext.createMediaElementSource(this.audioElement);
      
      // Create gain node for volume control
      this.gainNode = this.audioContext.createGain();
      
      // Connect: source -> gain -> destination
      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);
      
      // Setup event listeners
      this.audioElement.addEventListener('ended', () => {
        this.stopProgressTracking();
        if (this.onEndCallback) {
          this.onEndCallback();
        }
      });

      this.audioElement.addEventListener('error', (e) => {
        console.error('[AudioService] Playback error:', e);
        this.stopProgressTracking();
      });

      this.isInitialized = true;
      console.log('[AudioService] Initialized successfully');
    } catch (error) {
      console.error('[AudioService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Load and play a track
   */
  async play(track: Track, audioUrl: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.audioElement) {
      throw new Error('Audio element not initialized');
    }

    try {
      // Resume audio context if suspended (required on iOS Safari)
      if (this.audioContext?.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Load new track
      this.currentTrack = track;
      this.audioElement.src = audioUrl;
      await this.audioElement.play();
      
      this.startProgressTracking();
      console.log('[AudioService] Playing:', track.title);
    } catch (error) {
      console.error('[AudioService] Play error:', error);
      throw error;
    }
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (!this.audioElement || !this.isInitialized) {
      console.warn('[AudioService] Audio element not initialized');
      return;
    }

    this.audioElement.pause();
    this.stopProgressTracking();
    console.log('[AudioService] Paused');
  }

  /**
   * Resume playback
   */
  async resume(): Promise<void> {
    if (!this.audioElement || !this.isInitialized) {
      console.warn('[AudioService] Audio element not initialized');
      return;
    }

    try {
      // Resume audio context if suspended
      if (this.audioContext?.state === 'suspended') {
        await this.audioContext.resume();
      }

      await this.audioElement.play();
      this.startProgressTracking();
      console.log('[AudioService] Resumed');
    } catch (error) {
      console.error('[AudioService] Resume error:', error);
      throw error;
    }
  }

  /**
   * Seek to position (seconds)
   */
  seek(positionSeconds: number): void {
    if (!this.audioElement || !this.isInitialized) {
      console.warn('[AudioService] Audio element not initialized');
      return;
    }

    // Validate position is a finite number
    if (!Number.isFinite(positionSeconds) || positionSeconds < 0) {
      console.warn('[AudioService] Invalid seek position:', positionSeconds);
      return;
    }

    this.audioElement.currentTime = positionSeconds;
    console.log('[AudioService] Seeked to:', positionSeconds);
  }

  /**
   * Get current position (seconds)
   */
  getPosition(): number {
    if (!this.audioElement || !this.isInitialized) {
      return 0;
    }

    return this.audioElement.currentTime;
  }

  /**
   * Get duration (seconds)
   */
  getDuration(): number {
    if (!this.audioElement || !this.isInitialized) {
      return 0;
    }

    return this.audioElement.duration || 0;
  }

  /**
   * Set volume (0-1)
   */
  setVolume(volume: number): void {
    if (!this.gainNode || !this.isInitialized) {
      console.warn('[AudioService] Gain node not initialized');
      return;
    }

    const clampedVolume = Math.max(AUDIO_CONFIG.MIN_VOLUME, Math.min(AUDIO_CONFIG.MAX_VOLUME, volume));
    this.gainNode.gain.value = clampedVolume;
    console.log('[AudioService] Volume set to:', clampedVolume);
  }

  /**
   * Set playback rate (for sync)
   */
  setPlaybackRate(rate: number): void {
    if (!this.audioElement || !this.isInitialized) {
      console.warn('[AudioService] Audio element not initialized');
      return;
    }

    this.audioElement.playbackRate = rate;
  }

  /**
   * Get playback rate
   */
  getPlaybackRate(): number {
    if (!this.audioElement || !this.isInitialized) {
      return 1;
    }

    return this.audioElement.playbackRate;
  }

  /**
   * Check if playing
   */
  isPlaying(): boolean {
    if (!this.audioElement || !this.isInitialized) {
      return false;
    }

    return !this.audioElement.paused && !this.audioElement.ended;
  }

  /**
   * Get current track
   */
  getCurrentTrack(): Track | null {
    return this.currentTrack;
  }

  /**
   * Get audio context for EQ connection
   */
  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  /**
   * Get source node for EQ connection
   */
  getSourceNode(): MediaElementAudioSourceNode | null {
    return this.sourceNode;
  }

  /**
   * Get gain node for volume control
   */
  getGainNode(): GainNode | null {
    return this.gainNode;
  }

  /**
   * Set progress callback
   */
  onProgress(callback: (position: number) => void): void {
    this.onProgressCallback = callback;
  }

  /**
   * Set end callback
   */
  onEnd(callback: () => void): void {
    this.onEndCallback = callback;
  }

  /**
   * Start progress tracking (100ms interval)
   */
  private startProgressTracking(): void {
    this.stopProgressTracking();

    this.progressInterval = setInterval(() => {
      if (this.onProgressCallback && this.audioElement) {
        this.onProgressCallback(this.audioElement.currentTime);
      }
    }, 100);
  }

  /**
   * Stop progress tracking
   */
  private stopProgressTracking(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  /**
   * Stop playback and reset
   */
  stop(): void {
    this.pause();
    this.seek(0);
    this.currentTrack = null;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stop();
    this.stopProgressTracking();

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.audioElement = null;
    this.onProgressCallback = null;
    this.onEndCallback = null;
    this.isInitialized = false;
  }
}

// Singleton instance
export const audioService = new AudioService();
