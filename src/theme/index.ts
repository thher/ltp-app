import { darkColors, lightColors, Colors } from './colors';
import { typography, Typography } from './typography';
import { spacing, radius, Spacing, Radius } from './spacing';

export interface Theme {
  colors: Colors;
  typography: Typography;
  spacing: Spacing;
  radius: Radius;
  isDark: boolean;
}

export const darkTheme: Theme = {
  colors: darkColors,
  typography,
  spacing,
  radius,
  isDark: true,
};

export const lightTheme: Theme = {
  colors: lightColors,
  typography,
  spacing,
  radius,
  isDark: false,
};

export { darkColors, lightColors, typography, spacing, radius };
export type { Colors, Typography, Spacing, Radius };
