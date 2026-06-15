import React, { useState } from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface SearchBarProps {
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  onFocus?: () => void;
  autoFocus?: boolean;
}

export function SearchBar({
  placeholder = 'Søk...',
  value,
  onChangeText,
  onSubmit,
  onFocus,
  autoFocus,
}: SearchBarProps) {
  const { theme } = useTheme();
  const { colors, radius, spacing, typography } = theme;
  const [focused, setFocused] = useState(false);

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceElevated,
        borderRadius: radius.full,
        borderWidth: 1,
        borderColor: focused ? colors.primary : colors.border,
        paddingHorizontal: spacing.md,
        height: 48,
      }}
    >
      <Ionicons
        name="search-outline"
        size={20}
        color={focused ? colors.primary : colors.textMuted}
        style={{ marginRight: spacing.sm }}
      />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoFocus={autoFocus}
        returnKeyType="search"
        onSubmitEditing={onSubmit}
        onFocus={() => { setFocused(true); onFocus?.(); }}
        onBlur={() => setFocused(false)}
        style={[
          typography.bodyMedium,
          {
            flex: 1,
            color: colors.text,
            paddingVertical: 0,
          },
        ]}
      />
      {value.length > 0 && (
        <TouchableOpacity
          onPress={() => onChangeText('')}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}
