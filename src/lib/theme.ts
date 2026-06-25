/**
 * Kinders brand palette — ported from the mobile app's `src/constants/theme.ts`
 * (Material Design 3 token names), with no React Native dependencies so it can be
 * consumed by plain DOM/inline styles and CSS variables (see index.css).
 */
export const Brand = {
  // Primary — soft cyan (#00CCCB). Too light for white text, so fills use dark text.
  primary: '#00CCCB',
  onPrimary: '#00322F',
  primaryContainer: '#C7F4F3',
  onPrimaryContainer: '#00504F',

  // Secondary — soft coral
  secondary: '#F76363',
  onSecondary: '#FFFFFF',
  secondaryContainer: '#FFDAD7',
  onSecondaryContainer: '#7A1F20',

  // Tertiary — soft amber (used for "upcoming"/pending)
  tertiary: '#FFCC33',
  onTertiary: '#3D2E00',
  tertiaryContainer: '#FFEFC4',
  onTertiaryContainer: '#5C4100',

  // Success — soft green (used for "active"/positive)
  success: '#66CC9A',
  onSuccess: '#08381F',
  successContainer: '#D6F2E2',
  onSuccessContainer: '#0C4A2C',

  error: '#C62F2F',
  onError: '#FFFFFF',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#7A1113',

  // Neutrals / surfaces — soft cool off-white
  background: '#FAFCFC',
  surface: '#FAFCFC',
  surfaceContainerLow: '#F2F6F5',
  surfaceContainer: '#ECF1F0',
  surfaceContainerHigh: '#E5EBEA',
  onSurface: '#1A1C1C',
  onSurfaceVariant: '#46514F',
  outline: '#74807E',
  outlineVariant: '#DDE4E2',
  white: '#FFFFFF',
  disabled: '#C4CCCB',
} as const;

/** Corner radii from DESIGN.md (rem -> px at 16px base). */
export const Radius = {
  sm: 4,
  base: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

/** 8px baseline grid. */
export const Spacing = {
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
  eight: 48,
} as const;

export const FONT_FAMILY =
  "'Plus Jakarta Sans', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/** Stable, friendly colors for each of the 12 entry types (used in reports/charts). */
export const ENTRY_TYPE_COLORS: Record<string, string> = {
  check_in: '#00CCCB',
  checkout: '#46514F',
  activity: '#7C5CFF',
  health: '#F76363',
  temperature: '#FF8A5C',
  food: '#FFB020',
  sleep: '#5C8AFF',
  toilet: '#37C2A8',
  mood: '#FF6FB5',
  supplies: '#9B8B6A',
  notes: '#74807E',
  move_rooms: '#33B0C4',
};
