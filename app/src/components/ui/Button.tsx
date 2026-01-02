// app/src/components/ui/Button.tsx
// Base Button component with theme support

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
}) => {
  const { colors, spacing, fontSizes, borderRadius } = useTheme();

  const buttonStyles: ViewStyle = {
    ...styles.base,
    backgroundColor:
      variant === 'primary'
        ? colors.primary
        : variant === 'secondary'
        ? colors.surface
        : 'transparent',
    borderWidth: variant === 'outline' ? 1 : 0,
    borderColor: variant === 'outline' ? colors.primary : 'transparent',
    paddingVertical: size === 'small' ? spacing.sm : size === 'large' ? spacing.lg : spacing.md,
    paddingHorizontal: size === 'small' ? spacing.md : size === 'large' ? spacing.xl : spacing.lg,
    borderRadius: borderRadius.md,
    opacity: disabled ? 0.5 : 1,
  };

  const textStyles: TextStyle = {
    color: variant === 'primary' ? '#FFFFFF' : variant === 'outline' ? colors.primary : colors.text,
    fontSize: size === 'small' ? fontSizes.sm : size === 'large' ? fontSizes.lg : fontSizes.md,
    fontWeight: '600',
  };

  return (
    <TouchableOpacity
      style={[buttonStyles, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#FFFFFF' : colors.primary} />
      ) : (
        <Text style={[textStyles, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
});
