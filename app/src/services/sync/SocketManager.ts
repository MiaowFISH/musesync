// app/src/services/sync/SocketManager.ts
// Socket.io client connection manager

import { Platform } from 'react-native';
import type { SocketEvents } from '@shared/types/socket-events';
import { SOCKET_EVENTS, NETWORK_CONFIG } from '@shared/constants';

// Type-only import to avoid loading the module
type Socket = any;

/**
 * Socket Manager
 * Manages Socket.io connection with automatic reconnection
 * Note: Currently disabled for Web due to import.meta compatibility issues
 */
export class SocketManager {
  private socket: Socket | null = null;
  private serverUrl: string;
  private isConnecting = false;
  private isWebPlatform = Platform.OS === 'web';

  constructor(serverUrl: string = 'http://localhost:3000') {
    this.serverUrl = serverUrl;
    if (this.isWebPlatform) {
      console.log('[SocketManager] Socket.io is temporarily disabled on Web platform');
    }
  }

  /**
   * Connect to server
   */
  async connect(): Promise<void> {
    // Skip connection on Web platform for now
    if (this.isWebPlatform) {
      console.log('[SocketManager] Skipping connection on Web platform');
      return;
    }

    if (this.socket?.connected || this.isConnecting) {
      console.log('[SocketManager] Already connected or connecting');
      return;
    }

    this.isConnecting = true;

    // Dynamic import only on native platforms
    const { io } = await import('socket.io-client');

    this.socket = io(this.serverUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: NETWORK_CONFIG.RECONNECT_DELAY_MS,
      reconnectionDelayMax: NETWORK_CONFIG.RECONNECT_DELAY_MAX_MS,
      reconnectionAttempts: NETWORK_CONFIG.RECONNECT_ATTEMPTS,
      timeout: NETWORK_CONFIG.REQUEST_TIMEOUT_MS,
    });

    // Connection event handlers
    this.socket.on('connect', () => {
      console.log('[SocketManager] Connected:', this.socket?.id);
      this.isConnecting = false;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[SocketManager] Disconnected:', reason);
      this.isConnecting = false;
    });

    this.socket.on('connect_error', (error) => {
      console.error('[SocketManager] Connection error:', error);
      this.isConnecting = false;
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log('[SocketManager] Reconnected after', attemptNumber, 'attempts');
    });

    this.socket.on('reconnect_error', (error) => {
      console.error('[SocketManager] Reconnection error:', error);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('[SocketManager] Reconnection failed');
      this.isConnecting = false;
    });
  }

  /**
   * Disconnect from server
   */
  disconnect(): void {
    if (this.isWebPlatform) {
      return;
    }
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnecting = false;
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
   * Emit event to server
   */
  emit<K extends keyof SocketEvents>(event: K, data: Parameters<SocketEvents[K]>[0]): void {
    if (this.isWebPlatform) {
      console.warn('[SocketManager] emit() not available on Web platform');
      return;
    }
    if (!this.socket?.connected) {
      console.error('[SocketManager] Cannot emit, not connected');
      return;
    }
    this.socket.emit(event, data);
  }

  /**
   * Listen to event from server
   */
  on<K extends keyof SocketEvents>(event: K, handler: SocketEvents[K]): void {
    if (this.isWebPlatform) {
      return;
    }
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

// Singleton instance
export const socketManager = new SocketManager(
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000'
);
