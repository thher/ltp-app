import { Platform } from 'react-native';

const fontFamily = Platform.OS === 'ios'
  ? {
      regular: 'System',
      medium: 'System',
      semibold: 'System',
      bold: 'System',
    }
  : {
      regular: 'Roboto',
      medium: 'Roboto-Medium',
      semibold: 'Roboto-Medium',
      bold: 'Roboto-Bold',
    };

export const typography = {
  displayLarge: { fontSize: 32, fontWeight: '700' as const, letterSpacing: -0.5, lineHeight: 40 },
  displayMedium: { fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.3, lineHeight: 36 },
  displaySmall: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.2, lineHeight: 32 },
  headlineLarge: { fontSize: 22, fontWeight: '600' as const, letterSpacing: 0, lineHeight: 30 },
  headlineMedium: { fontSize: 20, fontWeight: '600' as const, letterSpacing: 0, lineHeight: 28 },
  headlineSmall: { fontSize: 18, fontWeight: '600' as const, letterSpacing: 0, lineHeight: 26 },
  titleLarge: { fontSize: 16, fontWeight: '600' as const, letterSpacing: 0.1, lineHeight: 24 },
  titleMedium: { fontSize: 14, fontWeight: '600' as const, letterSpacing: 0.1, lineHeight: 22 },
  titleSmall: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.1, lineHeight: 20 },
  bodyLarge: { fontSize: 16, fontWeight: '400' as const, letterSpacing: 0, lineHeight: 24 },
  bodyMedium: { fontSize: 14, fontWeight: '400' as const, letterSpacing: 0, lineHeight: 22 },
  bodySmall: { fontSize: 12, fontWeight: '400' as const, letterSpacing: 0, lineHeight: 18 },
  labelLarge: { fontSize: 14, fontWeight: '500' as const, letterSpacing: 0.1, lineHeight: 20 },
  labelMedium: { fontSize: 12, fontWeight: '500' as const, letterSpacing: 0.5, lineHeight: 18 },
  labelSmall: { fontSize: 11, fontWeight: '500' as const, letterSpacing: 0.5, lineHeight: 16 },
};

export type Typography = typeof typography;
