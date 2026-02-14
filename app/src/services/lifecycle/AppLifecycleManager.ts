// app/src/services/lifecycle/AppLifecycleManager.ts
// Manages app foreground/background transitions and triggers state reconciliation

import { AppState, AppStateStatus } from 'react-native';
import type { NativeEventSubscription } from 'react-native';
import { stateReconciler, type ReconciliationResult } from '../sync/StateReconciler';

/**
 * App Lifecycle Manager
 * Detects foreground/background transitions and triggers state reconciliation
 */
export class AppLifecycleManager {
  private isInBackground: boolean = false;
  private backgroundTimestamp: number = 0;
  private subscription: NativeEventSubscription | null = null;
  private listeners: Set<(result: ReconciliationResult) => void> = new Set();
  private currentRoomId: string | null = null;
  private currentUserId: string | null = null;

  /**
   * Start listening to app state changes
   */
  start(): void {
    if (this.subscription) {
      console.log('[AppLifecycle] Already started');
      return;
    }

    this.subscription = AppState.addEventListener('change', this.handleAppStateChange);
    console.log('[AppLifecycle] Started listening to app state changes');
  }

  /**
   * Stop listening to app state changes
   */
  stop(): void {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
      console.log('[AppLifecycle] Stopped listening to app state changes');
    }
  }

  /**
   * Set room context for reconciliation
   */
  setRoomContext(roomId: string | null, userId: string | null): void {
    this.currentRoomId = roomId;
    this.currentUserId = userId;
    console.log('[AppLifecycle] Room context updated:', { roomId, userId });
  }

  /**
   * Check if app is currently backgrounded
   */
  isBackgrounded(): boolean {
    return this.isInBackground;
  }

  /**
   * Subscribe to reconciliation results
   * Returns unsubscribe function
   */
  onReconciliation(listener: (result: ReconciliationResult) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Handle app state changes
   */
  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    const currentState = AppState.currentState;

    // Transitioning to background/inactive
    if (currentState === 'active' && (nextAppState === 'background' || nextAppState === 'inactive')) {
      this.handleBackground();
    }

    // Transitioning to foreground
    if ((currentState === 'background' || currentState === 'inactive') && nextAppState === 'active') {
      this.handleForeground();
    }
  };

  /**
   * Handle app entering background
   */
  private handleBackground(): void {
    this.isInBackground = true;
    this.backgroundTimestamp = Date.now();
    console.log('[AppLifecycle] Entered background — sync paused');
  }

  /**
   * Handle app returning to foreground
   */
  private async handleForeground(): Promise<void> {
    this.isInBackground = false;
    const backgroundDuration = Date.now() - this.backgroundTimestamp;
    console.log(`[AppLifecycle] Returned to foreground after ${Math.round(backgroundDuration / 1000)}s`);

    // Early return if no room context
    if (!this.currentRoomId || !this.currentUserId) {
      console.log('[AppLifecycle] No room context, skipping reconciliation');
      return;
    }

    // Trigger state reconciliation
    try {
      const result = await stateReconciler.reconcile({
        roomId: this.currentRoomId,
        userId: this.currentUserId,
        source: 'foreground',
      });

      console.log('[AppLifecycle] Reconciliation result:', result);

      // Notify all listeners
      this.listeners.forEach((listener) => {
        try {
          listener(result);
        } catch (error) {
          console.error('[AppLifecycle] Error in reconciliation listener:', error);
        }
      });
    } catch (error) {
      console.error('[AppLifecycle] Reconciliation error:', error);
    }
  }
}

// Singleton instance
export const appLifecycleManager = new AppLifecycleManager();
