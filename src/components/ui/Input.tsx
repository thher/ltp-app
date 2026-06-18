import React, { useState } from 'react';
import {
  TextInput,
  View,
  Text,
  TextInputProps,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  multiline?: boolean;
  numberOfLines?: number;
}

export function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  multiline,
  numberOfLines,
  ...props
}: InputProps) {
  const { theme } = useTheme();
  const { colors, radius, spacing, typography } = theme;
  const [focused, setFocused] = useState(false);

  return (
    <View style={[{ marginBottom: spacing.md }, containerStyle]}>
      {label && (
        <Text
          style={[
            typography.labelMedium,
            { color: colors.textSecondary, marginBottom: spacing.xs },
          ]}
        >
          {label}
        </Text>
      )}
      <View
        style={{
          flexDirection: 'row',
          alignItems: multiline ? 'flex-start' : 'center',
          backgroundColor: colors.surfaceElevated,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: error ? colors.error : focused ? colors.primary : colors.border,
          paddingHorizontal: spacing.md,
          paddingVertical: multiline ? spacing.md : 0,
          minHeight: multiline ? 100 : 48,
        }}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={20}
            color={focused ? colors.primary : colors.textMuted}
            style={{ marginRight: spacing.sm }}
          />
        )}
        <TextInput
          {...props}
          multiline={multiline}
          numberOfLines={numberOfLines}
          onFocus={(e) => { setFocused(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); props.onBlur?.(e); }}
          placeholderTextColor={colors.textMuted}
          style={[
            typography.bodyMedium,
            {
              flex: 1,
              color: colors.text,
              paddingVertical: multiline ? 0 : 14,
              textAlignVertical: multiline ? 'top' : 'center',
            },
            props.style,
          ]}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons
              name={rightIcon}
              size={20}
              color={colors.textMuted}
              style={{ marginLeft: spacing.sm }}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text style={[typography.bodySmall, { color: colors.error, marginTop: spacing.xs }]}>
          {error}
        </Text>
      )}
    </View>
  );
}
