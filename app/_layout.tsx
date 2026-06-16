import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SQLiteProvider } from 'expo-sqlite';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Suspense } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { ThemeProvider, useTheme } from '../src/context/ThemeContext';
import { LanguageProvider } from '../src/context/LanguageContext';
import { initializeDatabase } from '../src/database/schema';

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

async function initDB(db: Parameters<typeof initializeDatabase>[0]) {
  try {
    await initializeDatabase(db);
  } catch (e) {
    console.error('Database init error:', e);
    throw e;
  }
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Suspense fallback={<LoadingFallback />}>
        <SQLiteProvider databaseName="drinkmix.db" onInit={initDB} useSuspense>
          <ThemeProvider>
            <LanguageProvider>
              <AppContent />
            </LanguageProvider>
          </ThemeProvider>
        </SQLiteProvider>
      </Suspense>
    </GestureHandlerRootView>
  );
}
