// Design tokens do ChefIA. Verde como cor principal, neutros quentes e
// cores de destaque inspiradas em alimentos.
import { Platform } from 'react-native';

export const Colors = {
  primary: '#1E8E5A',
  primaryPressed: '#17734A',
  primaryDark: '#0F5136',
  primarySoft: '#E6F4EC',
  primaryTint: '#C9E8D6',

  background: '#F6F7F3',
  surface: '#FFFFFF',
  surfaceMuted: '#EEF1EC',
  border: '#E1E6DF',

  text: '#13201A',
  textSecondary: '#55625B',
  textMuted: '#87918B',
  textOnPrimary: '#FFFFFF',

  tomato: '#E8553A',
  tomatoSoft: '#FDEBE6',
  amber: '#D98A1C',
  amberSoft: '#FCF1DF',
  danger: '#C93636',
  dangerSoft: '#FBE7E7',
  info: '#2F6FDB',
  infoSoft: '#E6EEFB',

  overlay: 'rgba(10, 20, 15, 0.55)',
} as const;

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const Typography = {
  display: { fontSize: 30, lineHeight: 36, fontWeight: '800' as const, letterSpacing: -0.5 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700' as const, letterSpacing: -0.3 },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: '700' as const },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' as const },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: '600' as const },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' as const },
  captionStrong: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '600' as const, letterSpacing: 0.3 },
} as const;

export type TypographyVariant = keyof typeof Typography;

export const Shadow = Platform.select({
  web: { boxShadow: '0 2px 12px rgba(19, 32, 26, 0.06)' },
  default: {
    shadowColor: '#13201A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
}) as object;

export const MaxContentWidth = 640;
