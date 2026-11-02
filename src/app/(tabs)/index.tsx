import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { expiryLabel, expiryStatus, isExpiringSoon, todayIso } from '@shared/expiry';

import { LogoMark } from '@/components/brand';
import { RecipeSummaryRow } from '@/components/recipe-card';
import { AppText, Badge, Card, Screen, Section } from '@/components/ui';
import { Colors, Radius, Shadow, Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { APP_NAME } from '@/lib/env';
import { useAuth } from '@/providers/auth-provider';
import { listFridge } from '@/services/fridge';
import { getUsage } from '@/services/profile';
import { listGeneratedRecipes } from '@/services/recipes';
import { flowStore } from '@/state/flow-store';

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export default function Home() {
  const { profile } = useAuth();
  const today = todayIso();
  const home = useAsync(async () => {
    const [fridge, recent, usage] = await Promise.all([
      listFridge(),
      listGeneratedRecipes(3),
      getUsage().catch(() => null),
    ]);
    return { fridge, recent, usage };
  });

  const expiring = (home.data?.fridge ?? []).filter(
    (i) => isExpiringSoon(i.expires_on, today) || expiryStatus(i.expires_on, today) === 'expired',
  );
  const name = profile?.display_name?.split(' ')[0];

  function startScan() {
    flowStore.reset();
    router.push('/scan/capture');
  }

  return (
    <Screen safeTop refreshing={home.refreshing} onRefresh={home.refresh}>
      <View style={styles.topBar}>
        <LogoMark size={36} />
        <AppText variant="heading">{APP_NAME}</AppText>
        <View style={{ flex: 1 }} />
        {home.data?.usage ? (
          <Badge
            tone={home.data.usage.scan.used >= home.data.usage.scan.quota ? 'warning' : 'neutral'}
            icon="camera-outline"
            label={`${Math.max(0, home.data.usage.scan.quota - home.data.usage.scan.used)} fotos hoje`}
          />
        ) : null}
      </View>

      <View style={{ gap: 4 }}>
        <AppText variant="title">
          {greeting()}
          {name ? `, ${name}` : ''}! 👋
        </AppText>
        <AppText color={Colors.textSecondary}>O que vamos cozinhar hoje?</AppText>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Fotografar minha geladeira"
        onPress={startScan}
        style={({ pressed }) => [styles.hero, pressed && { transform: [{ scale: 0.985 }], opacity: 0.95 }]}>
        <View style={styles.heroIcon}>
          <Ionicons name="camera" size={40} color={Colors.primaryDark} />
        </View>
        <View style={{ gap: 6 }}>
          <AppText variant="title" color={Colors.textOnPrimary}>
            Fotografar minha geladeira
          </AppText>
          <AppText color={Colors.primaryTint}>A IA identifica os ingredientes e sugere receitas com o que você tem.</AppText>
        </View>
        <View style={styles.heroCta}>
          <AppText variant="bodyStrong" color={Colors.primaryDark}>
            Começar
          </AppText>
          <Ionicons name="arrow-forward" size={18} color={Colors.primaryDark} />
        </View>
      </Pressable>

      <View style={styles.quickRow}>
        <QuickAction icon="flash-outline" title="O que posso fazer agora?" subtitle="Sem foto, com Minha Geladeira" onPress={() => router.push('/what-now')} />
        <QuickAction
          icon="create-outline"
          title="Digitar ingredientes"
          subtitle="Monte a lista manualmente"
          onPress={() => {
            flowStore.reset();
            flowStore.set({ source: 'manual' });
            router.push('/scan/review');
          }}
        />
      </View>

      {expiring.length ? (
        <Card onPress={() => router.push('/fridge')} style={{ backgroundColor: Colors.amberSoft, borderColor: '#F3DDB5' }}>
          <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'center' }}>
            <AppText style={{ fontSize: 28, lineHeight: 34 }}>⏳</AppText>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyStrong">
                {expiring.length === 1 ? '1 item precisa de atenção' : `${expiring.length} itens precisam de atenção`}
              </AppText>
              <AppText variant="caption" color={Colors.textSecondary} numberOfLines={2}>
                {expiring
                  .slice(0, 3)
                  .map((i) => `${i.name} (${expiryLabel(i.expires_on, today)?.toLowerCase()})`)
                  .join(', ')}
              </AppText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </View>
        </Card>
      ) : null}

      {home.data?.recent.length ? (
        <Section
          title="Receitas recentes"
          action={
            <AppText variant="captionStrong" color={Colors.primary} onPress={() => router.push('/cookbook')}>
              Ver todas
            </AppText>
          }>
          {home.data.recent.map((r) => (
            <RecipeSummaryRow key={r.id} recipe={r} onPress={() => router.push(`/recipes/${r.id}`)} />
          ))}
        </Section>
      ) : null}

      <Card style={{ backgroundColor: Colors.primarySoft, borderColor: Colors.primaryTint }}>
        <AppText variant="captionStrong" color={Colors.primaryDark}>
          💡 Dica para uma boa foto
        </AppText>
        <AppText variant="caption" color={Colors.primaryDark} style={{ marginTop: 4 }}>
          Abra bem a porta, acenda a luz e fotografe de frente. Itens dentro de potes fechados ou gavetas podem não ser
          reconhecidos — você poderá adicioná-los depois.
        </AppText>
      </Card>
    </Screen>
  );
}

function QuickAction({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} style={{ flex: 1 }} accessibilityLabel={title}>
      <View style={styles.quickIcon}>
        <Ionicons name={icon} size={20} color={Colors.primary} />
      </View>
      <AppText variant="bodyStrong" style={{ marginTop: Spacing.sm }}>
        {title}
      </AppText>
      <AppText variant="caption" color={Colors.textSecondary}>
        {subtitle}
      </AppText>
    </Card>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  hero: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    gap: Spacing.lg,
    ...Shadow,
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: Radius.lg,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: Radius.pill,
  },
  quickRow: { flexDirection: 'row', gap: Spacing.md },
  quickIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
