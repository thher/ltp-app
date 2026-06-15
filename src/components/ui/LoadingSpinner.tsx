import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useTheme } from '../../context/ThemeContext';

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  fullScreen?: boolean;
}

export function LoadingSpinner({ size = 'large', fullScreen = false }: LoadingSpinnerProps) {
  const { theme } = useTheme();

  if (fullScreen) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}
      >
        <ActivityIndicator size={size} color={theme.colors.primary} />
      </View>
    );
  }

  return <ActivityIndicator size={size} color={theme.colors.primary} />;
}
