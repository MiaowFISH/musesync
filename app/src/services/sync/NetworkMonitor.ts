// app/src/services/sync/NetworkMonitor.ts
// Network connectivity monitor with auto-reconnection and state reconciliation

import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { socketManager } from './SocketManager';
import { stateReconciler } from './StateReconciler';

/**
 * Network status
 */
export interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string;
}

/**
 * Reconnection result callback
 */
export interface ReconnectionResult {
  success: boolean;
  changes?: {
    trackChanged: boolean;
    positionDrift: boolean;
    playStateChanged: boolean;
    queueChanged: boolean;
  };
  toastMessage?: string;
}

/**
 * Network Monitor
 * Monitors network connectivity and triggers reconnection + state reconciliation
 */
export class NetworkMonitor {
  private status: NetworkStatus = {
    isConnected: false,
    isInternetReachable: null,
    type: 'unknown',
  };
  private listeners: Set<(status: NetworkStatus) => void> = new Set();
  private reconnectionListeners: Set<(result: ReconnectionResult) => void> = new Set();
  private unsubscribeNetInfo: (() => void) | null = null;
  private wasDisconnected: boolean = false;
  private isReconciling: boolean = false;

  /**
   * Start monitoring network status
   */
  start(): void {
    if (this.unsubscribeNetInfo) {
      console.log('[NetworkMonitor] Already started');
      return;
    }

    console.log('[NetworkMonitor] Starting network monitoring');

    this.unsubscribeNetInfo = NetInfo.addEventListener((state: NetInfoState) => {
      this.handleNetworkChange(state);
    });
  }

  /**
   * Stop monitoring network status
   */
  stop(): void {
    if (this.unsubscribeNetInfo) {
      console.log('[NetworkMonitor] Stopping network monitoring');
      this.unsubscribeNetInfo();
      this.unsubscribeNetInfo = null;
    }
  }

  /**
   * Handle network state change
   */
  private async handleNetworkChange(state: NetInfoState): Promise<void> {
    const isConnected = state.isConnected ?? false;
    const isInternetReachable = state.isInternetReachable;
    const type = state.type || 'unknown';

    // Update internal status
    this.status = {
      isConnected,
      isInternetReachable,
      type,
    };

    console.log('[NetworkMonitor] Network status:', this.status);

    // Notify status listeners
    this.notifyStatusListeners();

    // Check for network recovery (transition from disconnected to connected)
    if (this.wasDisconnected && isConnected) {
      console.log('[NetworkMonitor] Network recovered, triggering reconnection');
      await this.handleNetworkRecovery();
    }

    // Update disconnection flag
    this.wasDisconnected = !isConnected;
  }

  /**
   * Handle network recovery: reconnect socket and reconcile state
   */
  private async handleNetworkRecovery(): Promise<void> {
    // Prevent concurrent reconciliation
    if (this.isReconciling) {
      console.log('[NetworkMonitor] Reconciliation already in progress');
      return;
    }

    this.isReconciling = true;

    try {
      // Reconnect socket if not connected
      if (!socketManager.isConnected()) {
        console.log('[NetworkMonitor] Socket not connected, reconnecting...');
        socketManager.connect();

        // Wait for socket connection (poll with timeout)
        const connected = await this.waitForSocketConnection(5000);
        if (!connected) {
          console.error('[NetworkMonitor] Socket reconnection timeout');
          this.notifyReconnectionListeners({ success: false });
          return;
        }
      }

      // Get current room context from socketManager
      const socket = socketManager.getSocket();
      const roomContext = (socketManager as any).currentRoomId;
      const userContext = (socketManager as any).currentUserId;

      if (!roomContext || !userContext) {
        console.log('[NetworkMonitor] No room context, skipping reconciliation');
        this.notifyReconnectionListeners({ success: true });
        return;
      }

      // Trigger state reconciliation
      console.log('[NetworkMonitor] Triggering state reconciliation');
      const result = await stateReconciler.reconcile({
        roomId: roomContext,
        userId: userContext,
        source: 'reconnection',
      });

      if (result.applied) {
        console.log('[NetworkMonitor] State reconciliation complete');
        this.notifyReconnectionListeners({
          success: true,
          changes: result.changes,
          toastMessage: result.toastMessage,
        });
      } else {
        console.warn('[NetworkMonitor] State reconciliation skipped:', result.reason);
        this.notifyReconnectionListeners({ success: false });
      }
    } catch (error) {
      console.error('[NetworkMonitor] Network recovery error:', error);
      this.notifyReconnectionListeners({ success: false });
    } finally {
      this.isReconciling = false;
    }
  }

  /**
   * Wait for socket connection with timeout
   */
  private async waitForSocketConnection(timeoutMs: number): Promise<boolean> {
    const startTime = Date.now();
    const pollInterval = 100;

    while (Date.now() - startTime < timeoutMs) {
      if (socketManager.isConnected()) {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, pollInterval));
    }

    return false;
  }

  /**
   * Get current network status
   */
  getStatus(): NetworkStatus {
    return { ...this.status };
  }

  /**
   * Subscribe to network status changes
   */
  onStatusChange(listener: (status: NetworkStatus) => void): () => void {
    this.listeners.add(listener);
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Subscribe to reconnection completion events
   */
  onReconnectionComplete(listener: (result: ReconnectionResult) => void): () => void {
    this.reconnectionListeners.add(listener);
    // Return unsubscribe function
    return () => {
      this.reconnectionListeners.delete(listener);
    };
  }

  /**
   * Notify status listeners
   */
  private notifyStatusListeners(): void {
    this.listeners.forEach((listener) => {
      try {
        listener(this.status);
      } catch (error) {
        console.error('[NetworkMonitor] Error in status listener:', error);
      }
    });
  }

  /**
   * Notify reconnection listeners
   */
  private notifyReconnectionListeners(result: ReconnectionResult): void {
    this.reconnectionListeners.forEach((listener) => {
      try {
        listener(result);
      } catch (error) {
        console.error('[NetworkMonitor] Error in reconnection listener:', error);
      }
    });
  }
}

// Singleton instance
export const networkMonitor = new NetworkMonitor();
