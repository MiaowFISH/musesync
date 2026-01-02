// app/src/components/common/Toast.tsx
// Toast notification component

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface ToastProps {
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  onDismiss?: () => void;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onDismiss,
}) => {
  const theme = useTheme();
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    // Auto dismiss
    const timer = setTimeout(() => {
      // Fade out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        onDismiss?.();
      });
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, fadeAnim, onDismiss]);

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return '#4CAF50';
      case 'warning':
        return '#FF9800';
      case 'error':
        return theme.colors.error || '#F44336';
      default:
        return theme.colors.surface;
    }
  };

  const getTextColor = () => {
    return type === 'info' ? theme.colors.text : '#FFFFFF';
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: getBackgroundColor(), opacity: fadeAnim },
      ]}
    >
      <Text style={[styles.message, { color: getTextColor() }]}>{message}</Text>
    </Animated.View>
  );
};

// Toast Manager for showing toasts globally
type ToastData = ToastProps & { id: string };

class ToastManager {
  private listeners: Array<(toast: ToastData | null) => void> = [];
  private currentToast: ToastData | null = null;

  subscribe(listener: (toast: ToastData | null) => void) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  show(message: string, type: ToastProps['type'] = 'info', duration?: number) {
    this.currentToast = {
      id: Date.now().toString(),
      message,
      type,
      duration,
    };
    this.notify();
  }

  success(message: string, duration?: number) {
    this.show(message, 'success', duration);
  }

  error(message: string, duration?: number) {
    this.show(message, 'error', duration);
  }

  warning(message: string, duration?: number) {
    this.show(message, 'warning', duration);
  }

  info(message: string, duration?: number) {
    this.show(message, 'info', duration);
  }

  dismiss() {
    this.currentToast = null;
    this.notify();
  }

  private notify() {
    this.listeners.forEach(listener => listener(this.currentToast));
  }
}

export const toast = new ToastManager();

// ToastContainer component to be placed at root level
export const ToastContainer: React.FC = () => {
  const [currentToast, setCurrentToast] = useState<ToastData | null>(null);

  useEffect(() => {
    const unsubscribe = toast.subscribe(setCurrentToast);
    return unsubscribe;
  }, []);

  if (!currentToast) return null;

  return (
    <View style={styles.toastContainer}>
      <Toast
        message={currentToast.message}
        type={currentToast.type}
        duration={currentToast.duration}
        onDismiss={() => toast.dismiss()}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 9999,
  },
  container: {
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
});
