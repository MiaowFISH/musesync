// app/src/services/audio/NativeAudioService.ts
// Native audio service using expo-audio for iOS and Android

import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';
import type { Track } from '@shared/types/entities';
import { AUDIO_CONFIG } from '@shared/constants';

/**
 * Audio Service for Native platforms (iOS/Android)
 * Uses expo-audio for native playback with new architecture support
 */
export class NativeAudioService {
  private player: AudioPlayer | null = null;
  private currentTrack: Track | null = null;
  private onProgressCallback: ((position: number) => void) | null = null;
  private onEndCallbacks: Array<() => void> = [];
  private isSetup = false;
  private _volume = 1;
  private _playbackRate = 1;
  private progressInterval: ReturnType<typeof setInterval> | null = null;
  private statusSubscription: { remove: () => void } | null = null;
  private lastReportedPlaying = false;

  /**
   * Initialize expo-audio player
   */
  async initialize(): Promise<void> {
    if (this.isSetup) {
      return;
    }

    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
      });

      this.isSetup = true;
      console.log('[NativeAudioService] Initialized successfully');
    } catch (error) {
      console.error('[NativeAudioService] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Setup status listener on the player to detect playback end
   */
  private setupStatusListener(): void {
    if (!this.player) return;

    // Clean up previous subscription
    this.statusSubscription?.remove();

    this.statusSubscription = this.player.addListener('playbackStatusUpdate', (status) => {
      const isPlaying = status.playing;

      // Detect transition from playing to not-playing at end of track
      if (this.lastReportedPlaying && !isPlaying && !this.player?.paused) {
        // Check if we're at the end (currentTime ~= duration)
        const atEnd = this.player &&
          this.player.duration > 0 &&
          this.player.currentTime >= this.player.duration - 0.5;

        if (atEnd && this.onEndCallbacks.length > 0) {
          console.log('[NativeAudioService] Track ended');
          for (const cb of this.onEndCallbacks) {
            try { cb(); } catch (e) { console.error('[NativeAudioService] onEnd callback error:', e); }
          }
        }
      }

      this.lastReportedPlaying = isPlaying;
    });
  }

  /**
   * Start progress polling
   */
  private startProgressPolling(): void {
    this.stopProgressPolling();

    this.progressInterval = setInterval(() => {
      if (this.player && this.onProgressCallback && !this.player.paused) {
        this.onProgressCallback(this.player.currentTime);
      }
    }, 100); // 100ms interval
  }

  /**
   * Stop progress polling
   */
  private stopProgressPolling(): void {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  /**
   * Load and play a track
   */
  async play(track: Track, audioUrl: string): Promise<void> {
    if (!this.isSetup) {
      await this.initialize();
    }

    try {
      // Release previous player
      if (this.player) {
        this.statusSubscription?.remove();
        this.statusSubscription = null;
        this.player.release();
        this.player = null;
      }

      // Create new player with the audio URL
      this.player = createAudioPlayer({ uri: audioUrl });

      // Configure player
      this.player.volume = this._volume;
      this.player.setPlaybackRate(this._playbackRate);

      // Setup lock screen metadata
      this.player.setActiveForLockScreen(true);
      this.player.updateLockScreenMetadata({
        title: track.title,
        artist: track.artist,
        artworkUrl: track.coverUrl ?? undefined,
      });

      // Setup listeners
      this.setupStatusListener();
      this.startProgressPolling();
      this.lastReportedPlaying = false;

      // Start playback
      this.player.play();

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
    if (!this.player) {
      console.warn('[NativeAudioService] Player not initialized');
      return;
    }

    try {
      this.player.pause();
      console.log('[NativeAudioService] Paused');
    } catch (error) {
      console.error('[NativeAudioService] Pause error:', error);
    }
  }

  /**
   * Resume playback
   */
  async resume(): Promise<void> {
    if (!this.player) {
      throw new Error('Player not initialized. Please load a track first.');
    }

    try {
      this.player.play();
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
    if (!this.player) {
      console.warn('[NativeAudioService] Player not initialized');
      return;
    }

    if (!Number.isFinite(positionSeconds) || positionSeconds < 0) {
      console.warn('[NativeAudioService] Invalid seek position:', positionSeconds);
      return;
    }

    try {
      this.player.seekTo(positionSeconds);
      console.log('[NativeAudioService] Seeked to:', positionSeconds);
    } catch (error) {
      console.error('[NativeAudioService] Seek error:', error);
    }
  }

  /**
   * Get current position (seconds)
   */
  async getPosition(): Promise<number> {
    if (!this.player) return 0;
    return this.player.currentTime;
  }

  /**
   * Get duration (seconds)
   */
  async getDuration(): Promise<number> {
    if (!this.player) return 0;
    return this.player.duration;
  }

  /**
   * Set volume (0-1)
   */
  async setVolume(volume: number): Promise<void> {
    const clampedVolume = Math.max(AUDIO_CONFIG.MIN_VOLUME, Math.min(AUDIO_CONFIG.MAX_VOLUME, volume));
    this._volume = clampedVolume;

    if (this.player) {
      this.player.volume = clampedVolume;
      console.log('[NativeAudioService] Volume set to:', clampedVolume);
    }
  }

  /**
   * Set playback rate (for sync)
   */
  async setPlaybackRate(rate: number): Promise<void> {
    this._playbackRate = rate;

    if (this.player) {
      this.player.setPlaybackRate(rate);
      console.log('[NativeAudioService] Playback rate set to:', rate);
    }
  }

  /**
   * Get playback rate
   */
  getPlaybackRate(): number {
    return this._playbackRate;
  }

  /**
   * Check if playing
   */
  async isPlaying(): Promise<boolean> {
    if (!this.player) return false;
    return !this.player.paused;
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
   * Add end callback (supports multiple listeners)
   * Returns unsubscribe function
   */
  onEnd(callback: () => void): () => void {
    this.onEndCallbacks.push(callback);
    return () => {
      this.onEndCallbacks = this.onEndCallbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * Stop playback and reset
   */
  async stop(): Promise<void> {
    this.stopProgressPolling();

    if (this.player) {
      try {
        this.player.pause();
        this.player.seekTo(0);
        this.currentTrack = null;
        console.log('[NativeAudioService] Stopped');
      } catch (error) {
        console.error('[NativeAudioService] Stop error:', error);
      }
    }
  }

  /**
   * Clean up resources
   */
  async dispose(): Promise<void> {
    this.stopProgressPolling();
    this.statusSubscription?.remove();
    this.statusSubscription = null;

    if (this.player) {
      try {
        this.player.release();
        this.player = null;
      } catch (error) {
        console.error('[NativeAudioService] Dispose error:', error);
      }
    }

    this.onProgressCallback = null;
    this.onEndCallbacks = [];
    this.currentTrack = null;
    this.isSetup = false;
    console.log('[NativeAudioService] Disposed');
  }
}
