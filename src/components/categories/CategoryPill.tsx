import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { FilterCategory } from '../../types';

interface CategoryPillProps {
  label: string;
  value: FilterCategory;
  selected: boolean;
  onPress: (value: FilterCategory) => void;
}

export function CategoryPill({ label, value, selected, onPress }: CategoryPillProps) {
  const { theme } = useTheme();
  const { colors, radius, spacing, typography } = theme;

  return (
    <TouchableOpacity
      onPress={() => onPress(value)}
      activeOpacity={0.75}
      style={{
        paddingHorizontal: spacing.base,
        paddingVertical: spacing.sm,
        borderRadius: radius.full,
        backgroundColor: selected ? colors.primary : colors.surfaceElevated,
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        marginRight: spacing.sm,
      }}
    >
      <Text
        style={[
          typography.labelMedium,
          { color: selected ? colors.textInverse : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}
