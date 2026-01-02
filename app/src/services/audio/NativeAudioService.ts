// app/src/services/audio/NativeAudioService.ts
// Native audio service using react-native-track-player for iOS and Android

import TrackPlayer, {
  Event,
  State,
  Capability,
  AppKilledPlaybackBehavior,
} from 'react-native-track-player';
import type { Track } from '@shared/types/entities';
import { AUDIO_CONFIG } from '@shared/constants';

/**
 * Audio Service for Native platforms (iOS/Android)
 * Uses react-native-track-player for optimized native playback
 */
export class NativeAudioService {
  private currentTrack: Track | null = null;
  private onProgressCallback: ((position: number) => void) | null = null;
  private onEndCallback: (() => void) | null = null;
  private isSetup = false;
  private volume = 1;
  private playbackRate = 1;

  /**
   * Setup Track Player
   * Must be called before using any player functions
   */
  async initialize(): Promise<void> {
    if (this.isSetup) {
      return;
    }

    try {
      // Check if player is already set up
      try {
        await TrackPlayer.getActiveTrackIndex();
        this.isSetup = true;
        console.log('[NativeAudioService] Track Player already initialized');
        return;
      } catch {
        // Player not set up, continue with initialization
      }

      // Setup the player
      await TrackPlayer.setupPlayer();

      // Configure player options
      await TrackPlayer.updateOptions({
        android: {
          appKilledPlaybackBehavior: AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
        },
        capabilities: [
          Capability.Play,
          Capability.Pause,
          Capability.Stop,
          Capability.SeekTo,
          Capability.SkipToNext,
          Capability.SkipToPrevious,
        ],
        compactCapabilities: [
          Capability.Play,
          Capability.Pause,
        ],
        progressUpdateEventInterval: 0.1, // Update every 100ms
      });

      // Setup event listeners
      this.setupEventListeners();

      this.isSetup = true;
      console.log('[NativeAudioService] Initialized successfully');
    } catch (error) {
      console.error('[NativeAudioService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup event listeners for track player events
   */
  private setupEventListeners(): void {
    // Listen for playback state changes
    TrackPlayer.addEventListener(Event.PlaybackState, async (data) => {
      if (data.state === State.Ended) {
        if (this.onEndCallback) {
          this.onEndCallback();
        }
      }
    });

    // Listen for progress updates
    TrackPlayer.addEventListener(Event.PlaybackProgressUpdated, (data) => {
      if (this.onProgressCallback && data.position !== undefined) {
        this.onProgressCallback(data.position);
      }
    });

    // Listen for errors
    TrackPlayer.addEventListener(Event.PlaybackError, (data) => {
      console.error('[NativeAudioService] Playback error:', data);
    });
  }

  /**
   * Load and play a track
   */
  async play(track: Track, audioUrl: string): Promise<void> {
    if (!this.isSetup) {
      await this.initialize();
    }

    try {
      // Reset the queue and add the new track
      await TrackPlayer.reset();
      await TrackPlayer.add({
        id: track.trackId,
        url: audioUrl,
        title: track.title,
        artist: track.artist,
        album: track.album,
        artwork: track.coverUrl,
        duration: track.duration / 1000, // Convert milliseconds to seconds
      });

      // Set volume and playback rate
      await TrackPlayer.setVolume(this.volume);
      await TrackPlayer.setRate(this.playbackRate);

      // Start playback
      await TrackPlayer.play();

      this.currentTrack = track;
      console.log('[NativeAudioService] Playing:', track.title);
    } catch (error) {
      console.error('[NativeAudioService] Play error:', error);
      throw error;
    }
  }

  /**
   * Pause playback
   */
  async pause(): Promise<void> {
    if (!this.isSetup) {
      console.warn('[NativeAudioService] Player not initialized');
      return;
    }

    try {
      await TrackPlayer.pause();
      console.log('[NativeAudioService] Paused');
    } catch (error) {
      console.error('[NativeAudioService] Pause error:', error);
    }
  }

  /**
   * Resume playback
   */
  async resume(): Promise<void> {
    if (!this.isSetup) {
      throw new Error('Player not initialized. Please load a track first.');
    }

    try {
      await TrackPlayer.play();
      console.log('[NativeAudioService] Resumed');
    } catch (error) {
      console.error('[NativeAudioService] Resume error:', error);
      throw error;
    }
  }

  /**
   * Seek to position (seconds)
   */
  async seek(positionSeconds: number): Promise<void> {
    if (!this.isSetup) {
      console.warn('[NativeAudioService] Player not initialized');
      return;
    }

    // Validate position is a finite number
    if (!Number.isFinite(positionSeconds) || positionSeconds < 0) {
      console.warn('[NativeAudioService] Invalid seek position:', positionSeconds);
      return;
    }

    try {
      await TrackPlayer.seekTo(positionSeconds);
      console.log('[NativeAudioService] Seeked to:', positionSeconds);
    } catch (error) {
      console.error('[NativeAudioService] Seek error:', error);
    }
  }

  /**
   * Get current position (seconds)
   */
  async getPosition(): Promise<number> {
    if (!this.isSetup) {
      return 0;
    }

    try {
      const progress = await TrackPlayer.getProgress();
      return progress.position;
    } catch (error) {
      console.error('[NativeAudioService] Get position error:', error);
      return 0;
    }
  }

  /**
   * Get duration (seconds)
   */
  async getDuration(): Promise<number> {
    if (!this.isSetup) {
      return 0;
    }

    try {
      const progress = await TrackPlayer.getProgress();
      return progress.duration;
    } catch (error) {
      console.error('[NativeAudioService] Get duration error:', error);
      return 0;
    }
  }

  /**
   * Set volume (0-1)
   */
  async setVolume(volume: number): Promise<void> {
    if (!this.isSetup) {
      console.warn('[NativeAudioService] Player not initialized');
      return;
    }

    const clampedVolume = Math.max(AUDIO_CONFIG.MIN_VOLUME, Math.min(AUDIO_CONFIG.MAX_VOLUME, volume));
    this.volume = clampedVolume;

    try {
      await TrackPlayer.setVolume(clampedVolume);
      console.log('[NativeAudioService] Volume set to:', clampedVolume);
    } catch (error) {
      console.error('[NativeAudioService] Set volume error:', error);
    }
  }

  /**
   * Set playback rate (for sync)
   */
  async setPlaybackRate(rate: number): Promise<void> {
    if (!this.isSetup) {
      console.warn('[NativeAudioService] Player not initialized');
      return;
    }

    this.playbackRate = rate;

    try {
      await TrackPlayer.setRate(rate);
      console.log('[NativeAudioService] Playback rate set to:', rate);
    } catch (error) {
      console.error('[NativeAudioService] Set playback rate error:', error);
    }
  }

  /**
   * Get playback rate
   */
  getPlaybackRate(): number {
    return this.playbackRate;
  }

  /**
   * Check if playing
   */
  async isPlaying(): Promise<boolean> {
    if (!this.isSetup) {
      return false;
    }

    try {
      const state = await TrackPlayer.getPlaybackState();
      return state.state === State.Playing;
    } catch (error) {
      console.error('[NativeAudioService] Get playing state error:', error);
      return false;
    }
  }

  /**
   * Get current track
   */
  getCurrentTrack(): Track | null {
    return this.currentTrack;
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
   * Stop playback and reset
   */
  async stop(): Promise<void> {
    if (!this.isSetup) {
      return;
    }

    try {
      await TrackPlayer.stop();
      await TrackPlayer.reset();
      this.currentTrack = null;
      console.log('[NativeAudioService] Stopped');
    } catch (error) {
      console.error('[NativeAudioService] Stop error:', error);
    }
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    if (!this.isSetup) {
      return;
    }

    try {
      await this.stop();
      await TrackPlayer.reset();
      this.onProgressCallback = null;
      this.onEndCallback = null;
      this.isSetup = false;
      console.log('[NativeAudioService] Disposed');
    } catch (error) {
      console.error('[NativeAudioService] Dispose error:', error);
    }
  }

  /**
   * Get audio context for EQ connection
   * Note: Not available on native platforms
   */
  getAudioContext(): AudioContext | null {
    console.warn('[NativeAudioService] AudioContext not available on native platforms');
    return null;
  }

  /**
   * Get source node for EQ connection
   * Note: Not available on native platforms
   */
  getSourceNode(): MediaElementAudioSourceNode | null {
    console.warn('[NativeAudioService] SourceNode not available on native platforms');
    return null;
  }

  /**
   * Get gain node for volume control
   * Note: Not available on native platforms
   */
  getGainNode(): GainNode | null {
    console.warn('[NativeAudioService] GainNode not available on native platforms');
    return null;
  }
}