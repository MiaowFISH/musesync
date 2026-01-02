// app/src/hooks/usePlayer.ts
// Custom hook for audio playback

import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { audioService } from '../services/audio/AudioService';
import { usePlayerStore } from '../stores';
import { playbackStateStorage } from '../services/storage/PlaybackStateStorage';
import type { Track } from '@shared/types/entities';

export interface UsePlayerResult {
  // State
  isPlaying: boolean;
  currentTrack: Track | null;
  position: number;
  duration: number;
  volume: number;
  playbackRate: number;
  
  // Controls
  play: (track: Track, audioUrl: string) => Promise<void>;
  pause: () => void;
  resume: () => Promise<void>;
  stop: () => void;
  seek: (positionSeconds: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  loadTrack: (track: Track) => void;
  
  // Status
  error: string | null;
  isLoading: boolean;
}

/**
 * Custom hook for managing audio playback
 * Works only on Web platform (React Native Web)
 */
export function usePlayer(): UsePlayerResult {
  const store = usePlayerStore();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const isInitializedRef = useRef(false);

  // Initialize audio service on mount (Web only)
  useEffect(() => {
    if (Platform.OS === 'web' && !isInitializedRef.current) {
      audioService.onProgress((position) => {
        store.setPosition(position);
      });

      audioService.onEnd(() => {
        store.setPlaying(false);
        store.setPosition(0);
      });

      isInitializedRef.current = true;
    }

    // Don't cleanup on unmount - AudioService is a singleton
    // and should persist across component mounts
  }, [store]);

  /**
   * Play a track
   */
  const play = useCallback(async (track: Track, audioUrl: string) => {
    if (Platform.OS !== 'web') {
      setError('Audio playback only supported on Web platform');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await audioService.play(track, audioUrl);
      store.setCurrentTrack(track);
      store.setPlaying(true);
      store.setDuration(track.duration);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Playback failed';
      setError(message);
      console.error('[usePlayer] Play error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [store]);

  /**
   * Pause playback
   */
  const pause = useCallback(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    audioService.pause();
    store.setPlaying(false);
  }, [store]);

  /**
   * Resume playback
   */
  const resume = useCallback(async () => {
    if (Platform.OS !== 'web') {
      return;
    }

    setError(null);

    try {
      await audioService.resume();
      store.setPlaying(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Resume failed';
      setError(message);
      console.error('[usePlayer] Resume error:', err);
    }
  }, [store]);

  /**
   * Stop playback
   */
  const stop = useCallback(() => {
    if (Platform.OS !== 'web') {
      return;
    }

    audioService.stop();
    store.reset();
  }, [store]);

  /**
   * Seek to position
   */
  const seek = useCallback((positionSeconds: number) => {
    if (Platform.OS !== 'web') {
      return;
    }

    audioService.seek(positionSeconds);
    store.setPosition(positionSeconds);
  }, [store]);

  /**
   * Set volume
   */
  const setVolume = useCallback((volume: number) => {
    if (Platform.OS !== 'web') {
      return;
    }

    audioService.setVolume(volume);
    store.setVolume(volume);
  }, [store]);

  /**
   * Set playback rate (for sync)
   */
  const setPlaybackRate = useCallback((rate: number) => {
    if (Platform.OS !== 'web') {
      return;
    }

    audioService.setPlaybackRate(rate);
    store.setPlaybackRate(rate);
  }, [store]);

  /**
   * Load track metadata without playing
   */
  const loadTrack = useCallback((track: Track) => {
    store.setCurrentTrack(track);
    store.setDuration(track.duration);
    store.setPosition(0);
  }, [store]);

  return {
    // State
    isPlaying: store.isPlaying,
    currentTrack: store.currentTrack,
    position: store.position,
    duration: store.duration,
    volume: store.volume,
    playbackRate: store.playbackRate,
    
    // Controls
    play,
    pause,
    resume,
    stop,
    seek,
    setVolume,
    setPlaybackRate,
    loadTrack,
    
    // Status
    error,
    isLoading,
  };
}
