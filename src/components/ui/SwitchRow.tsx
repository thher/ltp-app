import React from 'react';
import { View, Text, Switch, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface SwitchRowProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  style?: ViewStyle;
}

export function SwitchRow({ label, description, value, onValueChange, style }: SwitchRowProps) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: spacing.md,
        },
        style,
      ]}
    >
      <View style={{ flex: 1, marginRight: spacing.md }}>
        <Text style={[typography.bodyLarge, { color: colors.text }]}>{label}</Text>
        {description && (
          <Text style={[typography.bodySmall, { color: colors.textMuted, marginTop: 2 }]}>
            {description}
          </Text>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: `${colors.primary}88` }}
        thumbColor={value ? colors.primary : colors.textMuted}
      />
    </View>
  );
}
