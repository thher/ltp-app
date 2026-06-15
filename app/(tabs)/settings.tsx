import { useState } from 'react';
import { View, Text, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useTheme } from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { SwitchRow } from '../../src/components/ui/SwitchRow';
import { SettingsRow } from '../../src/components/ui/SettingsRow';
import { Divider } from '../../src/components/ui/Divider';
import { exportDatabase, importDatabase } from '../../src/services/exportService';
import { Language } from '../../src/types';
import Constants from 'expo-constants';

export default function SettingsScreen() {
  const { theme, colorScheme, setColorScheme } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const { colors, spacing, typography, radius } = theme;
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();

  const handleExport = async () => {
    const success = await exportDatabase();
    if (success) {
      Alert.alert(t.common.success, t.settings.exportSuccess);
    } else {
      Alert.alert(t.common.error, 'Kunne ikke eksportere database.');
    }
  };

  const handleImport = async () => {
    const success = await importDatabase();
    if (success) {
      Alert.alert(t.common.success, t.settings.importSuccess, [
        { text: t.common.ok, onPress: () => {} },
      ]);
    } else {
      Alert.alert(t.common.error, 'Kunne ikke importere database.');
    }
  };

  const handleReset = () => {
    Alert.alert(
      t.settings.resetDatabase,
      t.settings.resetConfirm,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            await db.execAsync(`
              DELETE FROM drink_ingredients;
              DELETE FROM favorites;
              DELETE FROM user_inventory;
              DELETE FROM drinks;
            `);
            Alert.alert(t.common.success, t.settings.resetSuccess);
          },
        },
      ]
    );
  };

  const SectionHeader = ({ title }: { title: string }) => (
    <Text
      style={[
        typography.labelMedium,
        {
          color: colors.textMuted,
          marginTop: spacing.xl,
          marginBottom: spacing.sm,
          paddingHorizontal: spacing.base,
          textTransform: 'uppercase',
          letterSpacing: 1,
        },
      ]}
    >
      {title}
    </Text>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          paddingTop: insets.top + spacing.md,
          paddingHorizontal: spacing.base,
          paddingBottom: spacing.md,
          borderBottomWidth: 1,
          borderBottomColor: colors.borderSubtle,
        }}
      >
        <Text style={[typography.headlineLarge, { color: colors.text }]}>
          {t.settings.title}
        </Text>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        {/* Appearance */}
        <SectionHeader title={t.settings.appearance} />
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            marginHorizontal: spacing.base,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.borderSubtle,
          }}
        >
          <View style={{ paddingHorizontal: spacing.base }}>
            <SwitchRow
              label={t.settings.darkMode}
              value={colorScheme === 'dark'}
              onValueChange={(v) => setColorScheme(v ? 'dark' : 'light')}
            />
          </View>
        </View>

        {/* Language */}
        <SectionHeader title={t.settings.language} />
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            marginHorizontal: spacing.base,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.borderSubtle,
          }}
        >
          <SettingsRow
            icon="language-outline"
            label={t.settings.norwegian}
            value={language === 'nb' ? '✓' : ''}
            onPress={() => setLanguage('nb')}
            showChevron={false}
          />
          <Divider style={{ marginVertical: 0, marginHorizontal: spacing.base }} />
          <SettingsRow
            icon="language-outline"
            label={t.settings.english}
            value={language === 'en' ? '✓' : ''}
            onPress={() => setLanguage('en')}
            showChevron={false}
          />
        </View>

        {/* Database */}
        <SectionHeader title={t.settings.database} />
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            marginHorizontal: spacing.base,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.borderSubtle,
          }}
        >
          <SettingsRow
            icon="download-outline"
            label={t.settings.exportDatabase}
            onPress={handleExport}
          />
          <Divider style={{ marginVertical: 0, marginHorizontal: spacing.base }} />
          <SettingsRow
            icon="cloud-upload-outline"
            label={t.settings.importDatabase}
            onPress={handleImport}
          />
          <Divider style={{ marginVertical: 0, marginHorizontal: spacing.base }} />
          <SettingsRow
            icon="trash-outline"
            label={t.settings.resetDatabase}
            onPress={handleReset}
            dangerous
          />
        </View>

        {/* About */}
        <SectionHeader title={t.settings.about} />
        <View
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.lg,
            marginHorizontal: spacing.base,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.borderSubtle,
          }}
        >
          <SettingsRow
            icon="information-circle-outline"
            label={t.settings.version}
            value={Constants.expoConfig?.version ?? '1.0.0'}
            showChevron={false}
          />
        </View>

        <Text
          style={[
            typography.bodySmall,
            {
              color: colors.textMuted,
              textAlign: 'center',
              marginTop: spacing.xl,
              paddingHorizontal: spacing.base,
            },
          ]}
        >
          DrinkMix © 2025
        </Text>
      </ScrollView>
    </View>
  );
}
