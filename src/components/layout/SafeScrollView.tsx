import React, { ReactNode } from 'react';
import { ScrollView, ScrollViewProps, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';

interface SafeScrollViewProps extends ScrollViewProps {
  children: ReactNode;
  bottomPadding?: boolean;
}

export function SafeScrollView({ children, bottomPadding = true, ...props }: SafeScrollViewProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      {...props}
      style={[{ flex: 1, backgroundColor: theme.colors.background }, props.style]}
      contentContainerStyle={[
        {
          paddingBottom: bottomPadding ? insets.bottom + theme.spacing.xl : theme.spacing.xl,
        },
        props.contentContainerStyle,
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}
