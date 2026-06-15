import React from 'react';
import { View, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface DividerProps {
  style?: ViewStyle;
  vertical?: boolean;
}

export function Divider({ style, vertical = false }: DividerProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          backgroundColor: theme.colors.border,
          ...(vertical
            ? { width: 1, height: '100%' }
            : { height: 1, width: '100%', marginVertical: theme.spacing.md }),
        },
        style,
      ]}
    />
  );
}
