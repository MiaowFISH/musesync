// app/src/components/lifecycle/AppLifecycleWatcher.tsx
// Component that wires useAppLifecycle hook at app root level

import { useAppLifecycle } from '../../hooks/useAppLifecycle';

/**
 * AppLifecycleWatcher
 * Invisible component that activates useAppLifecycle hook
 * Place inside StoreProvider in App.tsx
 */
export function AppLifecycleWatcher() {
  useAppLifecycle();
  return null;
}
