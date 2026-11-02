import { Ionicons } from '@expo/vector-icons';
import { router, type Href } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ALLERGY_OPTIONS, RESTRICTION_OPTIONS } from '@shared/safety';

import { AppText, Badge, Card, Divider, Screen, Section } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { useAuth } from '@/providers/auth-provider';
import { getUsage } from '@/services/profile';

function label(key: string) {
  return ALLERGY_OPTIONS.find((o) => o.key === key)?.label ?? RESTRICTION_OPTIONS.find((o) => o.key === key)?.label ?? key;
}

export default function ProfileTab() {
  const { profile, session, refreshProfile } = useAuth();
  const usage = useAsync(async () => {
    await refreshProfile();
    return getUsage();
  });
  const name = profile?.display_name || session?.user.email?.split('@')[0] || 'Você';
  const prefs = [...(profile?.allergies ?? []), ...(profile?.dietary_restrictions ?? [])];

  return (
    <Screen safeTop title="Perfil" refreshing={usage.refreshing} onRefresh={usage.refresh}>
      <Card style={styles.userCard}>
        <View style={styles.avatar}>
          <AppText variant="title" color={Colors.textOnPrimary}>
            {name.charAt(0).toUpperCase()}
          </AppText>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="heading">{name}</AppText>
          <AppText variant="caption" color={Colors.textSecondary}>
            {session?.user.email}
          </AppText>
        </View>
        <Badge tone={profile?.plan === 'premium' ? 'success' : 'neutral'} label={profile?.plan === 'premium' ? 'PREMIUM' : 'GRATUITO'} />
      </Card>

      {usage.data ? (
        <Section title="Uso de hoje">
          <Card style={{ gap: Spacing.md }}>
            <Meter icon="camera-outline" label="Análises de fotos" used={usage.data.scan.used} quota={usage.data.scan.quota} />
            <Meter icon="sparkles-outline" label="Gerações de receitas" used={usage.data.recipes.used} quota={usage.data.recipes.quota} />
            <AppText variant="caption" color={Colors.textMuted}>
              Os limites são renovados em uma janela de 24 horas.
            </AppText>
          </Card>
        </Section>
      ) : null}

      <Card style={{ gap: Spacing.sm, backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark }}>
        <AppText variant="heading" color={Colors.textOnPrimary}>
          ✨ ChefIA Premium
        </AppText>
        <AppText variant="caption" color={Colors.primaryTint}>
          Mais análises por dia, planejamento semanal, cardápios e listas completas. Ainda não disponível — estamos
          finalizando o plano. Nenhuma cobrança é feita no app.
        </AppText>
        <Badge label="EM BREVE" tone="warning" />
      </Card>

      <Section title="Conta e preferências">
        <Card padded={false}>
          <LinkRow
            icon="nutrition-outline"
            title="Preferências alimentares"
            subtitle={prefs.length ? prefs.map(label).join(', ') : 'Alergias, restrições, tempo, porções'}
            href="/preferences"
          />
          <Divider style={{ marginLeft: 56 }} />
          <LinkRow icon="settings-outline" title="Configurações" subtitle="Conta, privacidade, dados" href="/settings" />
          <Divider style={{ marginLeft: 56 }} />
          <LinkRow icon="shield-checkmark-outline" title="Privacidade e LGPD" subtitle="Como usamos seus dados e imagens" href="/privacy" />
        </Card>
      </Section>
    </Screen>
  );
}

function Meter({ icon, label, used, quota }: { icon: keyof typeof Ionicons.glyphMap; label: string; used: number; quota: number }) {
  const pct = quota ? Math.min(1, used / quota) : 0;
  return (
    <View style={{ gap: Spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm }}>
        <Ionicons name={icon} size={16} color={Colors.textSecondary} />
        <AppText variant="caption" style={{ flex: 1 }}>
          {label}
        </AppText>
        <AppText variant="captionStrong">
          {used}/{quota}
        </AppText>
      </View>
      <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: quota, now: used }}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: pct >= 1 ? Colors.amber : Colors.primary }]} />
      </View>
    </View>
  );
}

function LinkRow({ icon, title, subtitle, href }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle: string; href: Href }) {
  return (
    <Card padded={false} onPress={() => router.push(href)} style={styles.linkRow} accessibilityLabel={title}>
      <View style={styles.linkIcon}>
        <Ionicons name={icon} size={20} color={Colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="caption" color={Colors.textSecondary} numberOfLines={1}>
          {subtitle}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </Card>
  );
}

const styles = StyleSheet.create({
  userCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  track: { height: 8, borderRadius: Radius.pill, backgroundColor: Colors.surfaceMuted, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
    backgroundColor: 'transparent',
  },
  linkIcon: { width: 32, height: 32, borderRadius: Radius.sm, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
