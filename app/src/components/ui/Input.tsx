// app/src/components/ui/Input.tsx
// Base Input component with theme support

import React from 'react';
import { TextInput, View, Text, StyleSheet, TextInputProps, ViewStyle, TextStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export const Input: React.FC<InputProps> = ({ label, error, containerStyle, style, ...props }) => {
  const { colors, spacing, fontSizes, borderRadius } = useTheme();

  const inputStyles: TextStyle = {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: error ? colors.error : colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    fontSize: fontSizes.md,
    color: colors.text,
    minHeight: 48,
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text
          style={{
            fontSize: fontSizes.sm,
            color: colors.textSecondary,
            marginBottom: spacing.xs,
            fontWeight: '500',
          }}
        >
          {label}
        </Text>
      )}
      <TextInput
        style={[inputStyles, style]}
        placeholderTextColor={colors.textSecondary}
        {...props}
      />
      {error && (
        <Text
          style={{
            fontSize: fontSizes.xs,
            color: colors.error,
            marginTop: spacing.xs,
          }}
        >
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
