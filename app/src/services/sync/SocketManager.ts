// app/src/services/sync/SocketManager.ts
// Socket.io client connection manager

import { Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { preferencesStorage } from '../storage/PreferencesStorage';
import { stateReconciler } from './StateReconciler';
import type { SocketEvents } from '@shared/types/socket-events';
import { NETWORK_CONFIG } from '@shared/constants';

/**
 * Connection state
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface ReconnectInfo {
  attempt: number;
  maxAttempts: number;
  nextRetryMs: number;
}

/**
 * Socket Manager
 * Manages Socket.io connection with automatic reconnection
 */
export class SocketManager {
  private socket: Socket | null = null;
  private serverUrl: string;
  private connectionState: ConnectionState = 'disconnected';
  private stateListeners: Set<(state: ConnectionState) => void> = new Set();
  private reconnectInfoListeners: Set<(info: ReconnectInfo) => void> = new Set();
  private errorListeners: Set<(error: { message: string; code?: string }) => void> = new Set();
  private reconnectCount = 0;
  private maxReconnectAttempts = 10;
  private baseReconnectDelay = 1000;
  private clientId: string | null = null;
  private isReconnecting: boolean = false;
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;
  private currentUsername: string = '';
  private currentDeviceId: string = '';
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private readonly HEARTBEAT_INTERVAL = 20000; // 20s — well within server's 60s timeout

  constructor(serverUrl: string = 'http://localhost:3000') {
    this.serverUrl = serverUrl;
    console.log(`[SocketManager] Initialized with server URL: ${serverUrl}`);
  }

  /**
   * Update server URL (call after changing API URL in settings)
   */
  updateServerUrl(newUrl: string): void {
    if (this.serverUrl === newUrl) return;
    
    console.log(`[SocketManager] Updating URL from ${this.serverUrl} to ${newUrl}`);
    
    // Disconnect old connection if exists
    if (this.socket?.connected) {
      this.disconnect();
    }
    
    // Update server URL
    this.serverUrl = newUrl;
  }

  /**
   * Subscribe to error events
   */
  onError(listener: (error: { message: string; code?: string }) => void): () => void {
    this.errorListeners.add(listener);
    return () => { this.errorListeners.delete(listener); };
  }

  private notifyError(error: { message: string; code?: string }): void {
    this.errorListeners.forEach((listener) => {
      try { listener(error); } catch (e) { /* ignore */ }
    });
  }

  /**
   * Get or create a persistent client ID
   */
  async getOrCreateClientId(): Promise<string> {
    if (this.clientId) return this.clientId;

    try {
      const stored = await AsyncStorage.getItem('musesync:client_id');
      if (stored) {
        this.clientId = stored;
        return stored;
      }
    } catch (error) {
      console.error('[SocketManager] Failed to read clientId from storage:', error);
    }

    // Generate new UUID
    const id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });

    try {
      await AsyncStorage.setItem('musesync:client_id', id);
    } catch (error) {
      console.error('[SocketManager] Failed to store clientId:', error);
    }

    this.clientId = id;
    return id;
  }

  /**
   * Get cached client ID (synchronous)
   */
  getClientId(): string | null {
    return this.clientId;
  }

  /**
   * Store current room context for auto-rejoin on reconnection
   */
  setCurrentRoom(roomId: string, userId: string, username?: string, deviceId?: string): void {
    this.currentRoomId = roomId;
    this.currentUserId = userId;
    if (username) this.currentUsername = username;
    if (deviceId) this.currentDeviceId = deviceId;
    this.startHeartbeat();
  }

  /**
   * Clear room context (called on explicit leave)
   */
  clearCurrentRoom(): void {
    this.stopHeartbeat();
    this.currentRoomId = null;
    this.currentUserId = null;
    this.currentUsername = '';
    this.currentDeviceId = '';
  }

  /**
   * Check if currently reconnecting
   */
  getIsReconnecting(): boolean {
    return this.isReconnecting;
  }

  /**
   * Reset reconnect count (called by manual retry button)
   */
  resetReconnectCount(): void {
    console.log('[SocketManager] Resetting reconnect count');
    this.reconnectCount = 0;
    this.setConnectionState('connecting');
  }

  /**
   * Get current reconnection info
   */
  getReconnectInfo(): ReconnectInfo {
    const nextRetryMs = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectCount),
      30000
    );
    return {
      attempt: this.reconnectCount,
      maxAttempts: this.maxReconnectAttempts,
      nextRetryMs,
    };
  }

  /**
   * Subscribe to reconnect info changes
   */
  onReconnectInfoChange(listener: (info: ReconnectInfo) => void): () => void {
    this.reconnectInfoListeners.add(listener);
    return () => { this.reconnectInfoListeners.delete(listener); };
  }

  private notifyReconnectInfo(): void {
    const info = this.getReconnectInfo();
    this.reconnectInfoListeners.forEach((listener) => {
      try { listener(info); } catch (e) { /* ignore */ }
    });
  }

  /**
   * Connect to server
   */
  connect(): Socket {
    if (this.socket?.connected) {
      console.log('[SocketManager] Already connected');
      return this.socket;
    }

    if (this.socket && !this.socket.connected) {
      console.log('[SocketManager] Reconnecting existing socket...');
      this.socket.connect();
      return this.socket;
    }

    console.log(`[SocketManager] Connecting to ${this.serverUrl}...`);
    console.log(`[SocketManager] Platform: ${Platform.OS}`);
    this.setConnectionState('connecting');

    this.socket = io(this.serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: NETWORK_CONFIG.RECONNECT_DELAY_MS || 1000,
      reconnectionDelayMax: 30000, // 30s max delay (exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s)
      reconnectionAttempts: this.maxReconnectAttempts,
      timeout: NETWORK_CONFIG.REQUEST_TIMEOUT_MS || 10000,
      // Force WebSocket upgrade for better debugging
      forceNew: true,
    });

    this.setupEventHandlers();

    return this.socket;
  }

  /**
   * Setup socket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log(`[SocketManager] Connected with ID: ${this.socket?.id}`);
      this.reconnectCount = 0;
      // If we have room context, this is a reconnection — rejoin the room
      if (this.currentRoomId && this.currentUserId && this.clientId) {
        this.attemptRejoin();
      } else {
        this.setConnectionState('connected');
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`[SocketManager] Disconnected: ${reason}`);
      this.stopHeartbeat();
      if (reason !== 'io client disconnect') {
        this.setConnectionState('reconnecting');
        // socket.io auto-reconnect handles retries when reconnection: true
      } else {
        this.setConnectionState('disconnected');
      }
    });

    this.socket.on('connect_error', (error: any) => {
      console.error('[SocketManager] Connection error:', error.message);
      this.reconnectCount++;
      this.notifyReconnectInfo();

      if (this.reconnectCount >= this.maxReconnectAttempts) {
        console.error(`[SocketManager] Max reconnection attempts reached (${this.reconnectCount}/${this.maxReconnectAttempts})`);
        this.setConnectionState('error');
      } else {
        console.log(`[SocketManager] Reconnect attempt ${this.reconnectCount}/${this.maxReconnectAttempts}`);
        this.setConnectionState('reconnecting');
      }
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('[SocketManager] Reconnection error:', error);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('[SocketManager] Reconnection failed');
      this.setConnectionState('error');
    });

    this.socket.on('error', (error) => {
      console.error('[SocketManager] Socket error:', error);
    });
  }

  /**
   * Attempt to rejoin the current room after reconnection
   */
  private async attemptRejoin(): Promise<void> {
    if (!this.currentRoomId || !this.currentUserId || !this.clientId) {
      this.setConnectionState('connected');
      return;
    }

    this.isReconnecting = true;
    this.setConnectionState('reconnecting');

    const rejoinTimeout = setTimeout(() => {
      console.error('[SocketManager] Rejoin timeout');
      this.isReconnecting = false;
      this.setConnectionState('error');
    }, 5000);

    this.socket?.emit('room:rejoin', {
      roomId: this.currentRoomId,
      userId: this.currentUserId,
      clientId: this.clientId,
      username: this.currentUsername,
      deviceId: this.currentDeviceId,
      deviceType: Platform.OS as 'ios' | 'android' | 'web',
    }, async (response: any) => {
      clearTimeout(rejoinTimeout);
      this.isReconnecting = false;
      if (response?.success) {
        console.log('[SocketManager] Rejoin successful, triggering reconciliation');
        this.setConnectionState('connected');
        this.startHeartbeat();

        try {
          await stateReconciler.reconcile({
            roomId: this.currentRoomId!,
            userId: this.currentUserId!,
            source: 'reconnection',
          });
        } catch (error) {
          console.error('[SocketManager] Post-reconnection reconciliation failed:', error);
        }
      } else {
        console.error('[SocketManager] Rejoin failed:', response?.error);
        this.setConnectionState('error');

        // If room not found, notify error listeners
        if (response?.error?.includes('not found') || response?.error?.includes('Room not found')) {
          console.log('[SocketManager] Room not found, notifying error listeners');
          this.notifyError({
            message: 'Room not found',
            code: 'ROOM_NOT_FOUND'
          });
        }
      }
    });
  }

  /**
   * Start client heartbeat — sends keepalive to server every HEARTBEAT_INTERVAL ms.
   * Runs as long as we're in a room, regardless of which screen is active.
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    if (!this.currentRoomId || !this.currentUserId) return;

    console.log(`[SocketManager] Starting heartbeat for ${this.currentUserId} in room ${this.currentRoomId}`);

    this.heartbeatTimer = setInterval(() => {
      if (!this.socket?.connected || !this.currentRoomId || !this.currentUserId) return;

      this.socket.emit('sync:heartbeat', {
        roomId: this.currentRoomId,
        fromUserId: this.currentUserId,
        syncState: null,
        clientTime: Date.now(),
      });
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Stop client heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.socket) {
      console.log('[SocketManager] Disconnecting...');
      this.socket.disconnect();
      this.socket = null;
    }
    this.reconnectCount = 0;
    this.clearCurrentRoom();
    this.setConnectionState('disconnected');
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Get socket ID
   */
  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  /**
   * Get socket instance
   */
  getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Get connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Subscribe to connection state changes
   */
  onStateChange(listener: (state: ConnectionState) => void): () => void {
    this.stateListeners.add(listener);
    // Return unsubscribe function
    return () => {
      this.stateListeners.delete(listener);
    };
  }

  /**
   * Update connection state and notify listeners
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState === state) return;

    this.connectionState = state;
    console.log(`[SocketManager] State changed: ${state}`);

    // Notify all listeners
    this.stateListeners.forEach((listener) => {
      try {
        listener(state);
      } catch (error) {
        console.error('[SocketManager] Error in state listener:', error);
      }
    });
  }

  /**
   * Emit event to server
   */
  emit<K extends keyof SocketEvents>(event: K, data: Parameters<SocketEvents[K]>[0], callback?: (response: any) => void): void {
    if (!this.socket?.connected) {
      console.error('[SocketManager] Cannot emit, not connected');
      return;
    }
    
    if (callback) {
      this.socket.emit(event, data, callback);
    } else {
      this.socket.emit(event, data);
    }
  }

  /**
   * Listen to event from server
   */
  on<K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]): void {
    if (!this.socket) {
      console.error('[SocketManager] Cannot listen, socket not initialized');
      return;
    }
    this.socket.on(event, handler as any);
  }

  /**
   * Remove event listener
   */
  off<K extends keyof SocketEvents>(event: K, handler?: SocketEvents[K]): void {
    if (!this.socket) {
      return;
    }
    if (handler) {
      this.socket.off(event, handler as any);
    } else {
      this.socket.off(event);
    }
  }

  /**
   * Remove all listeners for an event
   */
  removeAllListeners<K extends keyof SocketEvents>(event?: K): void {
    if (!this.socket) {
      return;
    }
    if (event) {
      this.socket.removeAllListeners(event);
    } else {
      this.socket.removeAllListeners();
    }
  }
}

// Create singleton instance with default URL
// Will be updated with stored URL after initialization
const defaultUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
export const socketManager = new SocketManager(defaultUrl);

// Track initialization state
let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Initialize socket manager with stored URL
 * Call this early in app lifecycle
 * Returns a promise that resolves when initialization is complete
 */
export async function initializeSocketManager(): Promise<void> {
  // Return existing promise if already initializing
  if (initPromise) {
    return initPromise;
  }
  
  // Return immediately if already initialized
  if (isInitialized) {
    return Promise.resolve();
  }
  
  initPromise = (async () => {
    try {
      const savedUrl = await preferencesStorage.getApiUrl();
      if (savedUrl) {
        console.log(`[SocketManager] Loading saved URL: ${savedUrl}`);
        socketManager.updateServerUrl(savedUrl);
      } else {
        console.log(`[SocketManager] No saved URL, using default: ${defaultUrl}`);
      }
      isInitialized = true;
    } catch (error) {
      console.error('[SocketManager] Failed to load stored URL:', error);
      isInitialized = true; // Mark as initialized even on error to prevent infinite retries
    } finally {
      initPromise = null;
    }
  })();
  
  return initPromise;
}

/**
 * Update socket manager URL (call after saving new URL in settings)
 */
export function updateSocketManagerUrl(newUrl: string): void {
  socketManager.updateServerUrl(newUrl);
  isInitialized = true; // Mark as initialized after manual update
}

/**
 * Ensure socket manager is initialized before connecting
 * Call this before any socket operations
 */
export async function ensureInitialized(): Promise<void> {
  if (!isInitialized) {
    await initializeSocketManager();
  }
}
