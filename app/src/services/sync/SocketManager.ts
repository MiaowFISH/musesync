// app/src/services/sync/SocketManager.ts
// Socket.io client connection manager

import { Platform } from 'react-native';
import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { preferencesStorage } from '../storage/PreferencesStorage';
import type { SocketEvents } from '@shared/types/socket-events';
import { NETWORK_CONFIG } from '@shared/constants';

/**
 * Connection state
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

/**
 * Socket Manager
 * Manages Socket.io connection with automatic reconnection
 */
export class SocketManager {
  private socket: Socket | null = null;
  private serverUrl: string;
  private connectionState: ConnectionState = 'disconnected';
  private stateListeners: Set<(state: ConnectionState) => void> = new Set();
  private reconnectCount = 0;
  private maxReconnectAttempts = 5;
  private clientId: string | null = null;
  private isReconnecting: boolean = false;
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;

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
  setCurrentRoom(roomId: string, userId: string): void {
    this.currentRoomId = roomId;
    this.currentUserId = userId;
  }

  /**
   * Clear room context (called on explicit leave)
   */
  clearCurrentRoom(): void {
    this.currentRoomId = null;
    this.currentUserId = null;
  }

  /**
   * Check if currently reconnecting
   */
  getIsReconnecting(): boolean {
    return this.isReconnecting;
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
      reconnectionDelayMax: NETWORK_CONFIG.RECONNECT_DELAY_MAX_MS || 5000,
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
      this.setConnectionState('connected');
    });

    this.socket.on('disconnect', (reason) => {
      console.log(`[SocketManager] Disconnected: ${reason}`);
      // If not intentional disconnect, show reconnecting state
      if (reason !== 'io client disconnect') {
        this.setConnectionState('reconnecting');
      } else {
        this.setConnectionState('disconnected');
      }
    });

    this.socket.on('connect_error', (error: any) => {
      console.error('[SocketManager] Connection error:', error.message);
      console.error('[SocketManager] Error details:', {
        type: error.type || 'unknown',
        description: error.description || error.message,
        context: error.context || 'none',
        serverUrl: this.serverUrl,
        platform: Platform.OS,
      });
      this.reconnectCount++;
      
      if (this.reconnectCount >= this.maxReconnectAttempts) {
        console.error('[SocketManager] Max reconnection attempts reached');
        this.setConnectionState('error');
      } else {
        this.setConnectionState('connecting');
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`[SocketManager] Reconnected after ${attemptNumber} attempts`);
      this.reconnectCount = 0;

      // Auto-rejoin room if we were in one
      if (this.currentRoomId && this.currentUserId && this.clientId) {
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
          username: '',
          deviceId: '',
          deviceType: Platform.OS as 'ios' | 'android' | 'web',
        }, (response: any) => {
          clearTimeout(rejoinTimeout);
          this.isReconnecting = false;
          if (response?.success) {
            console.log('[SocketManager] Rejoin successful');
            this.setConnectionState('connected');
          } else {
            console.error('[SocketManager] Rejoin failed:', response?.error);
            this.setConnectionState('error');
          }
        });
      } else {
        this.setConnectionState('connected');
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
