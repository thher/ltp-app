import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface EmptyProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
}

export function Empty({ icon = 'search-outline', title, description }: EmptyProps) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;

  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xxl,
        paddingTop: spacing.massive,
      }}
    >
      <Ionicons name={icon} size={64} color={colors.textMuted} />
      <Text
        style={[
          typography.headlineSmall,
          { color: colors.textSecondary, marginTop: spacing.lg, textAlign: 'center' },
        ]}
      >
        {title}
      </Text>
      {description && (
        <Text
          style={[
            typography.bodyMedium,
            { color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
          ]}
        >
          {description}
        </Text>
      )}
    </View>
  );
}
