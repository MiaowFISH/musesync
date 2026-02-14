// app/src/stores/index.tsx
// React Context-based state management

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import type { Room, Track, SyncState, User, LocalPreferences } from '@shared/types/entities';
import type { QueueUpdatedEvent } from '@shared/types/socket-events';
import { playbackStateStorage } from '../services/storage/PlaybackStateStorage';
import { roomStateStorage } from '../services/storage/RoomStateStorage';
import { roomService } from '../services/sync/RoomService';
import { socketManager } from '../services/sync/SocketManager';

/**
 * Room Store Context
 */
interface QueueStateUpdate {
  playlist: Track[];
  currentTrackIndex: number;
  loopMode?: 'none' | 'queue';
}

interface RoomState {
  room: Room | null;
  isHost: boolean;
  setRoom: (room: Room | null) => void;
  updateSyncState: (syncState: SyncState) => void;
  updatePlaylist: (playlist: Track[]) => void;
  updateCurrentTrackIndex: (index: number) => void;
  updateQueueState: (update: QueueStateUpdate) => void;
  updateLoopMode: (loopMode: 'none' | 'queue') => void;
  addMember: (user: User) => void;
  removeMember: (userId: string) => void;
  clear: () => void;
}

const RoomContext = createContext<RoomState | undefined>(undefined);

export function RoomProvider({ children }: { children: ReactNode }) {
  const [room, setRoomState] = useState<Room | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [isRestored, setIsRestored] = useState(false);

  // Restore room state on mount
  useEffect(() => {
    const restoreState = async () => {
      const savedState = await roomStateStorage.getState();
      if (savedState && savedState.room) {
        console.log('[RoomProvider] Found saved room state:', savedState.room.roomId);
        
        // Wait for socket connection
        let retries = 0;
        const maxRetries = 10;
        while (!socketManager.getSocket()?.connected && retries < maxRetries) {
          console.log('[RoomProvider] Waiting for socket connection...');
          await new Promise(resolve => setTimeout(resolve, 500));
          retries++;
        }
        
        if (socketManager.getSocket()?.connected) {
          // Verify room still exists on server
          const verification = await roomService.verifyRoom(savedState.room.roomId);
          
          if (verification.exists) {
            console.log('[RoomProvider] Room verified, restoring state');
            setRoomState(savedState.room);
            setIsHost(savedState.isHost);
          } else {
            console.log('[RoomProvider] Room no longer exists, clearing state');
            await roomStateStorage.clearState();
          }
        } else {
          console.warn('[RoomProvider] Socket not connected, cannot verify room');
          // Still restore the state, will be verified when connection is established
          setRoomState(savedState.room);
          setIsHost(savedState.isHost);
        }
      }
      setIsRestored(true);
    };
    restoreState();
  }, []);

  // Save state when it changes
  useEffect(() => {
    if (!isRestored) return;
    
    const saveState = async () => {
      await roomStateStorage.saveState({
        room,
        isHost,
        timestamp: Date.now(),
      });
    };

    const timeoutId = setTimeout(saveState, 500);
    return () => clearTimeout(timeoutId);
  }, [room, isHost, isRestored]);

  const setRoom = useCallback((newRoom: Room | null) => {
    setRoomState(newRoom);
    setIsHost(newRoom?.hostId === newRoom?.members[0]?.userId || false);
    
    // Clear storage when leaving room
    if (newRoom === null) {
      roomStateStorage.clearState();
    }
  }, []);

  const updateSyncState = useCallback((syncState: SyncState) => {
    setRoomState((prev) => {
      if (!prev) return prev;
      console.log('[RoomProvider] Updating sync state, version:', syncState.version);
      return { ...prev, syncState };
    });
  }, []);

  const updatePlaylist = useCallback((playlist: Track[]) => {
    setRoomState((prev) => {
      if (!prev) return prev;
      return { ...prev, playlist };
    });
  }, []);

  const updateCurrentTrackIndex = useCallback((index: number) => {
    setRoomState((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        currentTrackIndex: index,
        currentTrack: index >= 0 && index < prev.playlist.length ? prev.playlist[index] : null,
      };
    });
  }, []);

  const updateQueueState = useCallback((update: QueueStateUpdate) => {
    setRoomState((prev) => {
      if (!prev) return prev;
      const { playlist, currentTrackIndex, loopMode } = update;
      return {
        ...prev,
        playlist,
        currentTrackIndex,
        currentTrack: currentTrackIndex >= 0 && currentTrackIndex < playlist.length
          ? playlist[currentTrackIndex]
          : null,
        ...(loopMode !== undefined ? { loopMode } : {}),
      };
    });
  }, []);

  const updateLoopMode = useCallback((loopMode: 'none' | 'queue') => {
    setRoomState((prev) => {
      if (!prev) return prev;
      return { ...prev, loopMode };
    });
  }, []);

  const addMember = useCallback((user: User) => {
    setRoomState((prev) => {
      if (!prev) return prev;
      const exists = prev.members.find((m) => m.userId === user.userId);
      if (exists) return prev;
      return { ...prev, members: [...prev.members, user] };
    });
  }, []);

  const removeMember = useCallback((userId: string) => {
    setRoomState((prev) => {
      if (!prev) return prev;
      return { ...prev, members: prev.members.filter((m) => m.userId !== userId) };
    });
  }, []);

  const clear = useCallback(() => {
    setRoomState(null);
    setIsHost(false);
    roomStateStorage.clearState();
  }, []);

  // Listen for queue:updated events at provider level so they're received
  // regardless of which screen the user is on
  useEffect(() => {
    const socket = socketManager.getSocket();
    if (!socket || !room?.roomId) return;

    const handleQueueUpdated = (event: QueueUpdatedEvent) => {
      if (event.roomId !== room.roomId) return;
      console.log('[RoomProvider] queue:updated received:', event.operation);
      updateQueueState({
        playlist: event.playlist,
        currentTrackIndex: event.currentTrackIndex,
        loopMode: event.loopMode,
      });
    };

    socket.on('queue:updated', handleQueueUpdated);
    console.log('[RoomProvider] Registered queue:updated listener for room:', room.roomId);

    return () => {
      socket.off('queue:updated', handleQueueUpdated);
    };
  }, [room?.roomId, updateQueueState]);

  return (
    <RoomContext.Provider
      value={{ room, isHost, setRoom, updateSyncState, updatePlaylist, updateCurrentTrackIndex, updateQueueState, updateLoopMode, addMember, removeMember, clear }}
    >
      {children}
    </RoomContext.Provider>
  );
}

export function useRoomStore() {
  const context = useContext(RoomContext);
  if (!context) throw new Error('useRoomStore must be used within RoomProvider');
  return context;
}

/**
 * Player Store Context
 */
interface PlayerState {
  isPlaying: boolean;
  currentTrack: Track | null;
  position: number;
  duration: number;
  volume: number;
  playbackRate: number;
  setPlaying: (isPlaying: boolean) => void;
  setCurrentTrack: (track: Track | null) => void;
  setPosition: (position: number) => void;
  setDuration: (duration: number) => void;
  setVolume: (volume: number) => void;
  setPlaybackRate: (rate: number) => void;
  reset: () => void;
}

const PlayerContext = createContext<PlayerState | undefined>(undefined);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrackState] = useState<Track | null>(null);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isRestored, setIsRestored] = useState(false);

  // Restore playback state on mount
  useEffect(() => {
    const restoreState = async () => {
      const savedState = await playbackStateStorage.getState();
      if (savedState && savedState.track) {
        setCurrentTrackState(savedState.track);
        setPosition(savedState.position);
        setDuration(savedState.track.duration);
        // Don't auto-play, just restore the state
        console.log('[PlayerProvider] Restored playback state:', savedState.track.title);
      }
      setIsRestored(true);
    };
    restoreState();
  }, []);

  // Save state when it changes
  useEffect(() => {
    if (!isRestored) return; // Don't save during restoration
    
    const saveState = async () => {
      await playbackStateStorage.saveState({
        track: currentTrack,
        position,
        isPlaying,
        audioUrl: null, // Audio URL expires, will need to re-fetch
        timestamp: Date.now(),
      });
    };

    const timeoutId = setTimeout(saveState, 1000); // Debounce saves
    return () => clearTimeout(timeoutId);
  }, [currentTrack, position, isPlaying, isRestored]);

  const setPlaying = useCallback((playing: boolean) => setIsPlaying(playing), []);

  const setCurrentTrack = useCallback((track: Track | null) => {
    setCurrentTrackState(track);
    setPosition(0);
    setDuration(track?.duration || 0);
  }, []);

  const setVolume = useCallback((vol: number) => {
    setVolumeState(Math.max(0, Math.min(1, vol)));
  }, []);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setCurrentTrackState(null);
    setPosition(0);
    setDuration(0);
    setVolumeState(1);
    setPlaybackRate(1);
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        isPlaying,
        currentTrack,
        position,
        duration,
        volume,
        playbackRate,
        setPlaying,
        setCurrentTrack,
        setPosition,
        setDuration,
        setVolume,
        setPlaybackRate,
        reset,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayerStore() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error('usePlayerStore must be used within PlayerProvider');
  return context;
}

/**
 * Preferences Store Context
 */
interface PreferencesState {
  preferences: LocalPreferences | null;
  setPreferences: (preferences: LocalPreferences) => void;
  updateTheme: (theme: LocalPreferences['theme']) => void;
  clear: () => void;
}

const PreferencesContext = createContext<PreferencesState | undefined>(undefined);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferencesState] = useState<LocalPreferences | null>(null);

  const setPreferences = useCallback((prefs: LocalPreferences) => {
    setPreferencesState(prefs);
  }, []);

  const updateTheme = useCallback((theme: LocalPreferences['theme']) => {
    setPreferencesState((prev) => {
      if (!prev) return prev;
      return { ...prev, theme };
    });
  }, []);

  const clear = useCallback(() => {
    setPreferencesState(null);
  }, []);

  return (
    <PreferencesContext.Provider
      value={{ preferences, setPreferences, updateTheme, clear }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferencesStore() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error('usePreferencesStore must be used within PreferencesProvider');
  return context;
}

/**
 * Connection Store Context
 */
interface ConnectionState {
  isConnected: boolean;
  socketId: string | null;
  latency: number;
  timeOffset: number;
  setConnected: (connected: boolean) => void;
  setSocketId: (socketId: string | null) => void;
  setLatency: (latency: number) => void;
  setTimeOffset: (offset: number) => void;
}

const ConnectionContext = createContext<ConnectionState | undefined>(undefined);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const [socketId, setSocketId] = useState<string | null>(null);
  const [latency, setLatency] = useState(0);
  const [timeOffset, setTimeOffset] = useState(0);

  // Sync connection state from SocketManager
  useEffect(() => {
    // Check initial state
    const socket = socketManager.getSocket();
    if (socket?.connected) {
      setIsConnected(true);
      setSocketId(socket.id ?? null);
    }

    const unsubscribe = socketManager.onStateChange((state) => {
      const connected = state === 'connected';
      setIsConnected(connected);
      if (connected) {
        setSocketId(socketManager.getSocket()?.id ?? null);
      }
    });

    return unsubscribe;
  }, []);

  const setConnected = useCallback((connected: boolean) => setIsConnected(connected), []);

  return (
    <ConnectionContext.Provider
      value={{ isConnected, socketId, latency, timeOffset, setConnected, setSocketId, setLatency, setTimeOffset }}
    >
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnectionStore() {
  const context = useContext(ConnectionContext);
  if (!context) throw new Error('useConnectionStore must be used within ConnectionProvider');
  return context;
}

/**
 * Combined Store Provider
 */
export function StoreProvider({ children }: { children: ReactNode }) {
  return (
    <ConnectionProvider>
      <PreferencesProvider>
        <PlayerProvider>
          <RoomProvider>{children}</RoomProvider>
        </PlayerProvider>
      </PreferencesProvider>
    </ConnectionProvider>
  );
}
