import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'error' | 'alcoholic' | 'nonAlcoholic';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  style?: ViewStyle;
}

export function Badge({ label, variant = 'default', style }: BadgeProps) {
  const { theme } = useTheme();
  const { colors, radius, spacing, typography } = theme;

  const variantColors: Record<BadgeVariant, { bg: string; text: string }> = {
    default: { bg: colors.surfaceHighlight, text: colors.textSecondary },
    primary: { bg: `${colors.primary}22`, text: colors.primary },
    success: { bg: `${colors.success}22`, text: colors.success },
    warning: { bg: `${colors.warning}22`, text: colors.warning },
    error: { bg: `${colors.error}22`, text: colors.error },
    alcoholic: { bg: `${colors.alcoholic}22`, text: colors.alcoholic },
    nonAlcoholic: { bg: `${colors.nonAlcoholic}22`, text: colors.nonAlcoholic },
  };

  const vc = variantColors[variant];

  return (
    <View
      style={[
        {
          backgroundColor: vc.bg,
          borderRadius: radius.full,
          paddingHorizontal: spacing.sm,
          paddingVertical: spacing.xxs,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text style={[typography.labelSmall, { color: vc.text }]}>{label}</Text>
    </View>
  );
}
