import React from 'react';
import { TouchableOpacity, View, Text, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface SettingsRowProps {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  value?: string;
  onPress?: () => void;
  dangerous?: boolean;
  style?: ViewStyle;
  showChevron?: boolean;
}

export function SettingsRow({
  icon,
  iconColor,
  label,
  value,
  onPress,
  dangerous = false,
  style,
  showChevron = true,
}: SettingsRowProps) {
  const { theme } = useTheme();
  const { colors, spacing, typography, radius } = theme;

  const labelColor = dangerous ? colors.error : colors.text;
  const iColor = iconColor ?? (dangerous ? colors.error : colors.primary);

  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.md,
          paddingHorizontal: spacing.base,
          backgroundColor: colors.surface,
        },
        style,
      ]}
    >
      {icon && (
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: radius.sm,
            backgroundColor: `${iColor}18`,
            alignItems: 'center',
            justifyContent: 'center',
            marginRight: spacing.md,
          }}
        >
          <Ionicons name={icon} size={20} color={iColor} />
        </View>
      )}
      <Text style={[typography.bodyLarge, { color: labelColor, flex: 1 }]}>{label}</Text>
      {value && (
        <Text style={[typography.bodyMedium, { color: colors.textMuted, marginRight: spacing.sm }]}>
          {value}
        </Text>
      )}
      {onPress && showChevron && (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      )}
    </Wrapper>
  );
}
