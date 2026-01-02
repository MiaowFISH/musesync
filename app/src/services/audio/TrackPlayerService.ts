// app/src/services/audio/TrackPlayerService.ts
// Service file for react-native-track-player setup
// This file is required by react-native-track-player for background playback

import TrackPlayer, { Event } from 'react-native-track-player';

/**
 * Track Player Service
 * This function is required by react-native-track-player to handle playback events
 * even when the app is in the background or closed
 */
export async function TrackPlayerService() {
  // Handle remote play event (e.g., from notification or lock screen)
  TrackPlayer.addEventListener(Event.RemotePlay, () => {
    TrackPlayer.play();
  });

  // Handle remote pause event
  TrackPlayer.addEventListener(Event.RemotePause, () => {
    TrackPlayer.pause();
  });

  // Handle remote stop event
  TrackPlayer.addEventListener(Event.RemoteStop, () => {
    TrackPlayer.stop();
  });

  // Handle remote next event
  TrackPlayer.addEventListener(Event.RemoteNext, () => {
    TrackPlayer.skipToNext();
  });

  // Handle remote previous event
  TrackPlayer.addEventListener(Event.RemotePrevious, () => {
    TrackPlayer.skipToPrevious();
  });

  // Handle remote seek event
  TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) => {
    TrackPlayer.seekTo(position);
  });

  // Handle remote duck (audio interruption)
  TrackPlayer.addEventListener(Event.RemoteDuck, async (event) => {
    if (event.paused) {
      // Pause playback when interrupted
      await TrackPlayer.pause();
    } else if (event.permanent) {
      // Stop playback if interruption is permanent
      await TrackPlayer.stop();
    } else {
      // Resume playback after interruption
      await TrackPlayer.play();
    }
  });

  console.log('[TrackPlayerService] Background service registered');
}

export default TrackPlayerService;