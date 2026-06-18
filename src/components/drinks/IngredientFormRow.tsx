import React from 'react';
import { View, TouchableOpacity, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { IngredientFormItem } from '../../types';

interface IngredientFormRowProps {
  item: IngredientFormItem;
  onChange: (key: string, field: keyof IngredientFormItem, value: string) => void;
  onRemove: (key: string) => void;
}

export function IngredientFormRow({ item, onChange, onRemove }: IngredientFormRowProps) {
  const { theme } = useTheme();
  const { colors, spacing, radius, typography } = theme;

  const inputStyle = {
    ...typography.bodyMedium,
    color: colors.text,
    backgroundColor: colors.surfaceElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    height: 44,
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm, gap: spacing.sm }}>
      <TextInput
        value={item.ingredient_name}
        onChangeText={(v) => onChange(item.key, 'ingredient_name', v)}
        placeholder="Ingrediens"
        placeholderTextColor={colors.textMuted}
        style={[inputStyle, { flex: 3 }]}
      />
      <TextInput
        value={item.amount}
        onChangeText={(v) => onChange(item.key, 'amount', v)}
        placeholder="Mengde"
        placeholderTextColor={colors.textMuted}
        style={[inputStyle, { flex: 1.5 }]}
        keyboardType="decimal-pad"
      />
      <TextInput
        value={item.unit}
        onChangeText={(v) => onChange(item.key, 'unit', v)}
        placeholder="Enhet"
        placeholderTextColor={colors.textMuted}
        style={[inputStyle, { flex: 1.5 }]}
      />
      <TouchableOpacity
        onPress={() => onRemove(item.key)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="remove-circle-outline" size={24} color={colors.error} />
      </TouchableOpacity>
    </View>
  );
}
