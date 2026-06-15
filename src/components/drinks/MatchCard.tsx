import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { DrinkMatch } from '../../types';

interface MatchCardProps {
  match: DrinkMatch;
  onPress: (match: DrinkMatch) => void;
}

export function MatchCard({ match, onPress }: MatchCardProps) {
  const { theme } = useTheme();
  const { colors, radius, spacing, typography } = theme;

  const { drink, matchPercent, missingIngredients, availableCount, totalCount } = match;

  const matchColor =
    matchPercent === 100
      ? colors.success
      : matchPercent >= 70
      ? colors.warning
      : colors.textMuted;

  return (
    <TouchableOpacity
      onPress={() => onPress(match)}
      activeOpacity={0.85}
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        marginBottom: spacing.md,
        flexDirection: 'row',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: colors.borderSubtle,
      }}
    >
      {drink.image ? (
        <Image
          source={{ uri: drink.image }}
          style={{ width: 100, height: 100 }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            width: 100,
            height: 100,
            backgroundColor: colors.surfaceHighlight,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="wine-outline" size={36} color={colors.textMuted} />
        </View>
      )}

      <View style={{ flex: 1, padding: spacing.md }}>
        <Text style={[typography.titleLarge, { color: colors.text }]} numberOfLines={1}>
          {drink.name}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs }}>
          <View
            style={{
              flex: 1,
              height: 4,
              backgroundColor: colors.border,
              borderRadius: radius.full,
              marginRight: spacing.sm,
            }}
          >
            <View
              style={{
                width: `${matchPercent}%`,
                height: '100%',
                backgroundColor: matchColor,
                borderRadius: radius.full,
              }}
            />
          </View>
          <Text style={[typography.labelMedium, { color: matchColor }]}>{matchPercent}%</Text>
        </View>

        <Text style={[typography.bodySmall, { color: colors.textSecondary, marginTop: spacing.xs }]}>
          {availableCount}/{totalCount} ingredienser
        </Text>

        {missingIngredients.length > 0 && (
          <Text
            style={[typography.bodySmall, { color: colors.textMuted, marginTop: spacing.xxs }]}
            numberOfLines={1}
          >
            Mangler: {missingIngredients.slice(0, 3).join(', ')}
            {missingIngredients.length > 3 ? ` +${missingIngredients.length - 3}` : ''}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}
