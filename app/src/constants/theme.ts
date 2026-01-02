// app/src/constants/theme.ts
// Theme configuration with dark/light mode support

import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '@shared/constants/colors';

export const theme = {
  light: {
    colors: COLORS.light,
    spacing: SPACING,
    fontSizes: FONT_SIZES,
    borderRadius: BORDER_RADIUS,
  },
  dark: {
    colors: COLORS.dark,
    spacing: SPACING,
    fontSizes: FONT_SIZES,
    borderRadius: BORDER_RADIUS,
  },
} as const;

export type Theme = typeof theme.light;
export type ThemeMode = 'light' | 'dark' | 'system';
