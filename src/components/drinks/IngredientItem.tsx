import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { DrinkIngredient } from '../../types';

interface IngredientItemProps {
  ingredient: DrinkIngredient;
  inInventory?: boolean;
}

export function IngredientItem({ ingredient, inInventory }: IngredientItemProps) {
  const { theme } = useTheme();
  const { colors, spacing, typography, radius } = theme;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: colors.surfaceElevated,
        borderRadius: radius.sm,
        marginBottom: spacing.xs,
        borderWidth: 1,
        borderColor: inInventory ? `${colors.success}40` : colors.borderSubtle,
      }}
    >
      <View
        style={{
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: inInventory ? colors.success : colors.primary,
          marginRight: spacing.md,
        }}
      />
      <Text style={[typography.bodyMedium, { color: colors.text, flex: 1 }]}>
        {ingredient.ingredient_name}
      </Text>
      {(ingredient.amount || ingredient.unit) && (
        <Text style={[typography.bodyMedium, { color: colors.primary, fontWeight: '600' }]}>
          {[ingredient.amount, ingredient.unit].filter(Boolean).join(' ')}
        </Text>
      )}
    </View>
  );
}
