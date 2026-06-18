import { useState, useEffect } from 'react';
import { View, Text, ScrollView, Alert, TextInput, TouchableOpacity, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSQLiteContext } from 'expo-sqlite';
import { useTheme } from '../../src/context/ThemeContext';
import { useLanguage } from '../../src/context/LanguageContext';
import { SwitchRow } from '../../src/components/ui/SwitchRow';
import { SettingsRow } from '../../src/components/ui/SettingsRow';
import { Divider } from '../../src/components/ui/Divider';
import { exportDatabase, importDatabase } from '../../src/services/exportService';
import { seedFromJson } from '../../src/services/seedService';
import { getApiKey, saveApiKey, deleteApiKey } from '../../src/services/aiService';
import { Language } from '../../src/types';
import Constants from 'expo-constants';

export default function SettingsScreen() {
  const { theme, colorScheme, setColorScheme } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const { colors, spacing, typography, radius } = theme;
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const [showApiModal, setShowApiModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    getApiKey().then(k => setHasApiKey(!!k));
  }, []);

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

  const handleImportStarter = async () => {
    try {
      const count = await seedFromJson(db, true);
      if (count > 0) {
        Alert.alert(t.common.success, `${count} ${t.settings.importStarterDbSuccess}`);
      } else {
        Alert.alert(t.common.success, t.settings.importStarterDbNone);
      }
    } catch {
      Alert.alert(t.common.error, 'Kunne ikke importere startdatabasen.');
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
            icon="flask-outline"
            label={t.settings.importStarterDb}
            onPress={handleImportStarter}
          />
          <Divider style={{ marginVertical: 0, marginHorizontal: spacing.base }} />
          <SettingsRow
            icon="trash-outline"
            label={t.settings.resetDatabase}
            onPress={handleReset}
            dangerous
          />
        </View>

        {/* AI / Skann */}
        <SectionHeader title="AI Ingrediens-skanner" />
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
            icon="key-outline"
            label="Anthropic API-nøkkel"
            value={hasApiKey ? '●●●●●●●●' : 'Ikke satt'}
            onPress={() => { setApiKeyInput(''); setShowApiModal(true); }}
          />
          {hasApiKey && (
            <SettingsRow
              icon="trash-outline"
              label="Slett API-nøkkel"
              onPress={() =>
                Alert.alert('Slett nøkkel', 'Er du sikker?', [
                  { text: 'Avbryt', style: 'cancel' },
                  {
                    text: 'Slett',
                    style: 'destructive',
                    onPress: async () => { await deleteApiKey(); setHasApiKey(false); },
                  },
                ])
              }
              dangerous
            />
          )}
        </View>
        <Text style={[typography.bodySmall, { color: colors.textMuted, marginHorizontal: spacing.base + 4, marginTop: spacing.sm, marginBottom: spacing.xl }]}>
          Trengs for å skanne ingredienser med kamera. Få gratis nøkkel på console.anthropic.com
        </Text>

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

      <Modal visible={showApiModal} transparent animationType="slide" onRequestClose={() => setShowApiModal(false)}>
        <View style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }}>
          <View style={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            padding: spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
          }}>
            <Text style={[typography.headlineSmall, { color: colors.text, marginBottom: spacing.xs }]}>
              Anthropic API-nøkkel
            </Text>
            <Text style={[typography.bodySmall, { color: colors.textMuted, marginBottom: spacing.lg }]}>
              Hent gratis nøkkel på console.anthropic.com
            </Text>
            <TextInput
              value={apiKeyInput}
              onChangeText={setApiKeyInput}
              placeholder="sk-ant-..."
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              style={[typography.bodyMedium, {
                color: colors.text,
                backgroundColor: colors.surfaceElevated,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.md,
                marginBottom: spacing.lg,
              }]}
            />
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <TouchableOpacity
                onPress={() => setShowApiModal(false)}
                style={{ flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceElevated, alignItems: 'center' }}
              >
                <Text style={[typography.labelLarge, { color: colors.textSecondary }]}>Avbryt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (!apiKeyInput.trim()) return;
                  await saveApiKey(apiKeyInput.trim());
                  setHasApiKey(true);
                  setShowApiModal(false);
                  Alert.alert('Lagret', 'API-nøkkel er lagret sikkert på enheten.');
                }}
                style={{ flex: 1, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.primary, alignItems: 'center' }}
              >
                <Text style={[typography.labelLarge, { color: colors.textInverse }]}>Lagre</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
