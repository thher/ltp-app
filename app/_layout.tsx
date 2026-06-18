import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { LanguageProvider } from '../src/context/LanguageContext';
import { ensureSchema } from '../src/database/schema';

function AppContent() {
  const { theme, colorScheme } = useTheme();

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="drink/[id]" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="drink/add" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="drink/edit/[id]" options={{ headerShown: false, animation: 'slide_from_bottom' }} />
        <Stack.Screen name="search" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

function LoadingFallback() {
  return (
    <View style={{ flex: 1, backgroundColor: '#0D0D0D', alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator size="large" color="#C8A96E" />
      <Text style={{ color: '#C8A96E', marginTop: 16, fontSize: 16 }}>Laster DrinkMix...</Text>
    </View>
  );
}

async function setupDatabase(): Promise<void> {
  const dbDir = FileSystem.documentDirectory + 'SQLite/';
  const dbPath = dbDir + 'drinkmix.db';

  // Remove stale WAL/SHM files — these make data invisible after a failed import
  try {
    await FileSystem.deleteAsync(dbPath + '-wal', { idempotent: true });
    await FileSystem.deleteAsync(dbPath + '-shm', { idempotent: true });
  } catch {
    // Non-fatal
  }

  const info = await FileSystem.getInfoAsync(dbPath);
  if (!info.exists) {
    try {
      await FileSystem.makeDirectoryAsync(dbDir, { intermediates: true });
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const asset = Asset.fromModule(require('../assets/drinkmix.db'));
      await asset.downloadAsync();
      if (asset.localUri) {
        await FileSystem.copyAsync({ from: asset.localUri, to: dbPath });
      }
    } catch (e) {
      console.warn('[DrinkMix] Could not copy bundled DB, will seed from JSON:', e);
    }
  }
}

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setupDatabase()
      .then(() => setReady(true))
      .catch((e) => {
        console.error('DB setup error:', e);
        setReady(true); // fall through to runtime seeding via onInit
      });
  }, []);

  if (!ready) return <LoadingFallback />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SQLiteProvider databaseName="drinkmix.db" onInit={ensureSchema}>
        <ThemeProvider>
          <LanguageProvider>
            <AppContent />
          </LanguageProvider>
        </ThemeProvider>
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}
