// Estados de carregamento, vazio e erro reutilizáveis.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, View } from 'react-native';

import { Colors, Radius, Spacing } from '@/constants/theme';
import type { AppError } from '@/lib/api';

import { AppText } from './app-text';
import { Button } from './button';

export function LoadingState({ message }: { message?: string }) {
  return (
    <View style={styles.center} accessibilityLiveRegion="polite">
      <ActivityIndicator color={Colors.primary} size="large" />
      {message ? (
        <AppText variant="caption" color={Colors.textSecondary} center>
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

export function EmptyState({
  emoji,
  title,
  message,
  actionLabel,
  onAction,
}: {
  emoji: string;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.center}>
      <View style={styles.emojiCircle}>
        <AppText style={{ fontSize: 36, lineHeight: 44 }}>{emoji}</AppText>
      </View>
      <AppText variant="heading" center>
        {title}
      </AppText>
      {message ? (
        <AppText variant="body" color={Colors.textSecondary} center style={{ maxWidth: 320 }}>
          {message}
        </AppText>
      ) : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} style={{ marginTop: Spacing.sm }} /> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: AppError | Error; onRetry?: () => void }) {
  const retryable = 'retryable' in error ? (error as AppError).retryable : true;
  return (
    <View style={styles.center} accessibilityRole="alert">
      <View style={[styles.emojiCircle, { backgroundColor: Colors.dangerSoft }]}>
        <Ionicons name="alert-circle-outline" size={36} color={Colors.danger} />
      </View>
      <AppText variant="heading" center>
        Não deu certo
      </AppText>
      <AppText variant="body" color={Colors.textSecondary} center style={{ maxWidth: 320 }}>
        {error.message}
      </AppText>
      {onRetry && retryable ? <Button title="Tentar novamente" icon="refresh" onPress={onRetry} /> : null}
    </View>
  );
}

export function InlineError({ message }: { message: string }) {
  return (
    <View style={styles.inlineError} accessibilityRole="alert">
      <Ionicons name="alert-circle" size={18} color={Colors.danger} />
      <AppText variant="caption" color={Colors.danger} style={{ flex: 1 }}>
        {message}
      </AppText>
    </View>
  );
}

export function Notice({
  icon = 'information-circle',
  tone = 'info',
  children,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  tone?: 'info' | 'warning' | 'success';
  children: string;
}) {
  const c =
    tone === 'warning'
      ? { bg: Colors.amberSoft, fg: '#8A5A12' }
      : tone === 'success'
        ? { bg: Colors.primarySoft, fg: Colors.primaryDark }
        : { bg: Colors.infoSoft, fg: Colors.info };
  return (
    <View style={[styles.notice, { backgroundColor: c.bg }]}>
      <Ionicons name={icon} size={18} color={c.fg} />
      <AppText variant="caption" color={c.fg} style={{ flex: 1 }}>
        {children}
      </AppText>
    </View>
  );
}

/** Lista de etapas reais do processamento, com a etapa atual animada. */
export function ProgressSteps({ steps, current }: { steps: string[]; current: number }) {
  const [pulse] = useState(() => new Animated.Value(0.4));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={{ gap: Spacing.md }} accessibilityLiveRegion="polite">
      {steps.map((label, idx) => {
        const done = idx < current;
        const active = idx === current;
        return (
          <View key={label} style={styles.stepRow}>
            {done ? (
              <Ionicons name="checkmark-circle" size={22} color={Colors.primary} />
            ) : active ? (
              <Animated.View style={[styles.activeDot, { opacity: pulse }]} />
            ) : (
              <View style={styles.idleDot} />
            )}
            <AppText
              variant={active ? 'bodyStrong' : 'body'}
              color={done ? Colors.textSecondary : active ? Colors.text : Colors.textMuted}>
              {label}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl },
  emojiCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineError: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'center',
    backgroundColor: Colors.dangerSoft,
    padding: Spacing.md,
    borderRadius: Radius.md,
  },
  notice: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, alignItems: 'flex-start' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  activeDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.primary },
  idleDot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: Colors.border },
});
