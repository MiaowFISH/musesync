// shared/constants/colors.ts
// Theme color definitions

export const COLORS = {
  // Light theme
  light: {
    primary: '#1DB954',      // Spotify green
    secondary: '#191414',
    background: '#FFFFFF',
    surface: '#F5F5F5',
    text: '#191414',
    textSecondary: '#6A6A6A',
    border: '#E0E0E0',
    error: '#E74C3C',
    success: '#2ECC71',
    warning: '#F39C12',
    info: '#3498DB',
  },
  // Dark theme
  dark: {
    primary: '#1DB954',
    secondary: '#FFFFFF',
    background: '#121212',
    surface: '#282828',
    text: '#FFFFFF',
    textSecondary: '#B3B3B3',
    border: '#404040',
    error: '#E74C3C',
    success: '#2ECC71',
    warning: '#F39C12',
    info: '#3498DB',
  },
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const FONT_SIZES = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
} as const;

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  round: 9999,
} as const;
