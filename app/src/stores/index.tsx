// app/src/stores/index.tsx
// React Context-based state management

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Room, Track, SyncState, User, LocalPreferences } from '@shared/types/entities';

/**
 * Room Store Context
 */
interface RoomState {
  room: Room | null;
  isHost: boolean;
  setRoom: (room: Room | null) => void;
  updateSyncState: (syncState: SyncState) => void;
  updatePlaylist: (playlist: Track[]) => void;
  addMember: (user: User) => void;
  removeMember: (userId: string) => void;
  clear: () => void;
}

const RoomContext = createContext<RoomState | undefined>(undefined);

export function RoomProvider({ children }: { children: ReactNode }) {
  const [room, setRoomState] = useState<Room | null>(null);
  const [isHost, setIsHost] = useState(false);

  const setRoom = useCallback((newRoom: Room | null) => {
    setRoomState(newRoom);
    setIsHost(newRoom?.hostId === newRoom?.members[0]?.userId || false);
  }, []);

  const updateSyncState = useCallback((syncState: SyncState) => {
    setRoomState((prev) => {
      if (!prev) return prev;
      return { ...prev, syncState };
    });
  }, []);

  const updatePlaylist = useCallback((playlist: Track[]) => {
    setRoomState((prev) => {
      if (!prev) return prev;
      return { ...prev, playlist };
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
  }, []);

  return (
    <RoomContext.Provider
      value={{ room, isHost, setRoom, updateSyncState, updatePlaylist, addMember, removeMember, clear }}
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
  updateEQPreset: (presetId: string | null) => void;
  toggleEQ: () => void;
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

  const updateEQPreset = useCallback((presetId: string | null) => {
    setPreferencesState((prev) => {
      if (!prev) return prev;
      return { ...prev, currentEQPresetId: presetId };
    });
  }, []);

  const toggleEQ = useCallback(() => {
    setPreferencesState((prev) => {
      if (!prev) return prev;
      return { ...prev, eqEnabled: !prev.eqEnabled };
    });
  }, []);

  const clear = useCallback(() => {
    setPreferencesState(null);
  }, []);

  return (
    <PreferencesContext.Provider
      value={{ preferences, setPreferences, updateTheme, updateEQPreset, toggleEQ, clear }}
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
