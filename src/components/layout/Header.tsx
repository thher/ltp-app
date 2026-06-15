import React from 'react';
import { View, Text, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useRouter } from 'expo-router';

interface HeaderProps {
  title: string;
  showBack?: boolean;
  rightAction?: {
    icon: keyof typeof Ionicons.glyphMap;
    onPress: () => void;
    label?: string;
  };
  transparent?: boolean;
}

export function Header({ title, showBack = false, rightAction, transparent = false }: HeaderProps) {
  const { theme } = useTheme();
  const { colors, spacing, typography } = theme;
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      style={{
        paddingTop: insets.top,
        backgroundColor: transparent ? 'transparent' : colors.background,
        borderBottomWidth: transparent ? 0 : 1,
        borderBottomColor: colors.borderSubtle,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          height: 56,
          paddingHorizontal: spacing.base,
        }}
      >
        {showBack && (
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ marginRight: spacing.md, padding: spacing.xs }}
          >
            <Ionicons name="chevron-back" size={24} color={colors.text} />
          </TouchableOpacity>
        )}
        <Text
          style={[
            typography.headlineMedium,
            { color: colors.text, flex: 1 },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {rightAction && (
          <TouchableOpacity
            onPress={rightAction.onPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ padding: spacing.xs }}
          >
            <Ionicons name={rightAction.icon} size={24} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
