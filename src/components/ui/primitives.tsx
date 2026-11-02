// Componentes básicos reutilizáveis: Card, Chip, Badge, IconButton, Section,
// SegmentedControl, Stepper, Divider.
import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';

import { AppText } from './app-text';

type IconName = keyof typeof Ionicons.glyphMap;

export function Card({
  children,
  onPress,
  style,
  padded = true,
  accessibilityLabel,
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  accessibilityLabel?: string;
}) {
  const content = [styles.card, padded && styles.cardPadded, style];
  if (!onPress) return <View style={content}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [...content, pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] }]}>
      {children}
    </Pressable>
  );
}

export function Chip({
  label,
  selected,
  onPress,
  icon,
  emoji,
  onRemove,
  tone = 'default',
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  emoji?: string;
  onRemove?: () => void;
  tone?: 'default' | 'danger';
}) {
  const activeBg = tone === 'danger' ? Colors.dangerSoft : Colors.primarySoft;
  const activeFg = tone === 'danger' ? Colors.danger : Colors.primaryDark;
  const activeBorder = tone === 'danger' ? Colors.danger : Colors.primary;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { selected: !!selected } : undefined}
      onPress={onPress}
      disabled={!onPress && !onRemove}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? activeBg : Colors.surface,
          borderColor: selected ? activeBorder : Colors.border,
          opacity: pressed ? 0.75 : 1,
        },
      ]}>
      {emoji ? <AppText variant="caption">{emoji}</AppText> : null}
      {icon ? <Ionicons name={icon} size={14} color={selected ? activeFg : Colors.textSecondary} /> : null}
      <AppText variant="captionStrong" color={selected ? activeFg : Colors.text}>
        {label}
      </AppText>
      {onRemove ? (
        <Pressable accessibilityLabel={`Remover ${label}`} hitSlop={8} onPress={onRemove}>
          <Ionicons name="close" size={14} color={Colors.textSecondary} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export function ChipGroup({ children }: { children: ReactNode }) {
  return <View style={styles.chipGroup}>{children}</View>;
}

type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';
const BADGE: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: Colors.surfaceMuted, fg: Colors.textSecondary },
  success: { bg: Colors.primarySoft, fg: Colors.primaryDark },
  warning: { bg: Colors.amberSoft, fg: '#8A5A12' },
  danger: { bg: Colors.dangerSoft, fg: Colors.danger },
  info: { bg: Colors.infoSoft, fg: Colors.info },
};

export function Badge({ label, tone = 'neutral', icon }: { label: string; tone?: BadgeTone; icon?: IconName }) {
  const c = BADGE[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      {icon ? <Ionicons name={icon} size={12} color={c.fg} /> : null}
      <AppText variant="micro" color={c.fg}>
        {label}
      </AppText>
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  color = Colors.text,
  size = 22,
  style,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  color?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: Colors.surfaceMuted }, style]}>
      <Ionicons name={icon} size={size} color={color} />
    </Pressable>
  );
}

export function Section({
  title,
  action,
  children,
  style,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[{ gap: Spacing.md }, style]}>
      {title || action ? (
        <View style={styles.sectionHeader}>
          {title ? <AppText variant="heading">{title}</AppText> : <View />}
          {action}
        </View>
      ) : null}
      {children}
    </View>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[styles.segment, active && styles.segmentActive]}>
            <AppText variant="captionStrong" color={active ? Colors.text : Colors.textSecondary} numberOfLines={1}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 20,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
}) {
  return (
    <View style={styles.stepper}>
      <IconButton icon="remove" label={`Diminuir ${label}`} onPress={() => onChange(Math.max(min, value - 1))} />
      <AppText variant="heading" style={{ minWidth: 28, textAlign: 'center' }} accessibilityLabel={`${label}: ${value}`}>
        {value}
      </AppText>
      <IconButton icon="add" label={`Aumentar ${label}`} onPress={() => onChange(Math.min(max, value + 1))} />
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: Colors.border }, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
    ...Shadow,
  },
  cardPadded: { padding: Spacing.lg },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    alignSelf: 'flex-start',
  },
  iconButton: { width: 40, height: 40, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  segmented: {
    flexDirection: 'row',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.md,
    padding: 3,
  },
  segment: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: Radius.sm + 2 },
  segmentActive: { backgroundColor: Colors.surface, ...Shadow },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceMuted,
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.xs,
  },
});
