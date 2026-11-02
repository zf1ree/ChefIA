import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

import { AppText } from './app-text';

export interface ScreenProps {
  children: ReactNode;
  /** Título grande no topo (telas de abas, sem header nativo). */
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
  scroll?: boolean;
  /** Respeitar a área segura do topo (quando não há header nativo). */
  safeTop?: boolean;
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
}

export function Screen({
  children,
  title,
  subtitle,
  headerRight,
  scroll = true,
  safeTop = false,
  footer,
  refreshing,
  onRefresh,
  contentStyle,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const header = title ? (
    <View style={styles.header}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="title" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color={Colors.textSecondary}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {headerRight}
    </View>
  ) : null;

  const inner = [styles.content, contentStyle];
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[{ paddingBottom: Spacing.xxl }, styles.centered]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={Colors.primary} /> : undefined}>
      <View style={inner}>
        {header}
        {children}
      </View>
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, styles.centered]}>
      <View style={[inner, { flex: 1 }]}>
        {header}
        {children}
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.root, safeTop && { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {body}
      {footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background },
  centered: { width: '100%', alignItems: 'center' },
  content: { width: '100%', maxWidth: MaxContentWidth, padding: Spacing.lg, gap: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingTop: Spacing.sm },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
});
