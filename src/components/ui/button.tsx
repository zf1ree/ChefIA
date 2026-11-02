import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';

import { AppText } from './app-text';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style' | 'children'> {
  title: string;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  loading?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

const VARIANTS: Record<Variant, { bg: string; pressed: string; fg: string; border?: string }> = {
  primary: { bg: Colors.primary, pressed: Colors.primaryPressed, fg: Colors.textOnPrimary },
  secondary: { bg: Colors.primarySoft, pressed: Colors.primaryTint, fg: Colors.primaryDark },
  ghost: { bg: 'transparent', pressed: Colors.surfaceMuted, fg: Colors.primary },
  outline: { bg: Colors.surface, pressed: Colors.surfaceMuted, fg: Colors.text, border: Colors.border },
  danger: { bg: Colors.dangerSoft, pressed: '#F6D3D3', fg: Colors.danger },
};

const SIZES: Record<Size, { h: number; px: number; icon: number }> = {
  sm: { h: 36, px: Spacing.md, icon: 16 },
  md: { h: 48, px: Spacing.lg, icon: 18 },
  lg: { h: 56, px: Spacing.xl, icon: 22 },
};

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  icon,
  loading,
  disabled,
  fullWidth,
  style,
  ...rest
}: ButtonProps) {
  const v = VARIANTS[variant];
  const s = SIZES[size];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        {
          height: s.h,
          paddingHorizontal: s.px,
          backgroundColor: pressed ? v.pressed : v.bg,
          borderColor: v.border ?? 'transparent',
          borderWidth: v.border ? 1 : 0,
          opacity: isDisabled ? 0.55 : 1,
          alignSelf: fullWidth ? 'stretch' : 'auto',
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <View style={styles.row}>
          {icon && <Ionicons name={icon} size={s.icon} color={v.fg} />}
          <AppText variant={size === 'sm' ? 'captionStrong' : 'bodyStrong'} color={v.fg} numberOfLines={1}>
            {title}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
