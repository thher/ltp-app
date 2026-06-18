import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  fullWidth = false,
}: ButtonProps) {
  const { theme } = useTheme();
  const { colors, radius, spacing, typography } = theme;

  const variantStyles: Record<ButtonVariant, { bg: string; border: string; text: string }> = {
    primary: { bg: colors.primary, border: colors.primary, text: colors.textInverse },
    secondary: { bg: colors.surfaceElevated, border: colors.border, text: colors.text },
    ghost: { bg: 'transparent', border: 'transparent', text: colors.primary },
    danger: { bg: colors.error, border: colors.error, text: '#FFFFFF' },
  };

  const sizeStyles: Record<ButtonSize, { height: number; px: number; font: TextStyle }> = {
    sm: { height: 36, px: spacing.base, font: typography.labelMedium },
    md: { height: 48, px: spacing.xl, font: typography.labelLarge },
    lg: { height: 56, px: spacing.xxl, font: typography.titleMedium },
  };

  const vs = variantStyles[variant];
  const ss = sizeStyles[size];
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.75}
      style={[
        {
          height: ss.height,
          paddingHorizontal: ss.px,
          backgroundColor: vs.bg,
          borderColor: vs.border,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: isDisabled ? 0.5 : 1,
          ...(fullWidth && { width: '100%' }),
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={vs.text} />
      ) : (
        <Text style={[ss.font, { color: vs.text }, textStyle]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}
