import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { RecipeSummaryRow } from '@/components/recipe-card';
import { AppText, Button, Card, EmptyState, ErrorState, LoadingState, Screen, SegmentedControl } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { categoryEmoji, formatDateBR } from '@/lib/labels';
import { listCooked, listFavorites, listGeneratedRecipes } from '@/services/recipes';
import { listScans } from '@/services/scans';
import { flowStore, newKey } from '@/state/flow-store';

type Tab = 'favorites' | 'generated' | 'cooked' | 'scans';

export default function Cookbook() {
  const [tab, setTab] = useState<Tab>('favorites');
  return (
    <Screen safeTop title="Minhas receitas">
      <SegmentedControl<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'favorites', label: 'Favoritas' },
          { value: 'generated', label: 'Histórico' },
          { value: 'cooked', label: 'Preparadas' },
          { value: 'scans', label: 'Análises' },
        ]}
      />
      {tab === 'favorites' ? <Favorites /> : tab === 'generated' ? <Generated /> : tab === 'cooked' ? <Cooked /> : <Scans />}
    </Screen>
  );
}

function Favorites() {
  const s = useAsync(listFavorites);
  if (s.loading) return <LoadingState />;
  if (s.error) return <ErrorState error={s.error} onRetry={s.reload} />;
  if (!s.data?.length)
    return <EmptyState emoji="❤️" title="Nenhuma favorita ainda" message="Toque no coração de uma receita para guardá-la aqui." />;
  return (
    <View style={{ gap: Spacing.sm }}>
      {s.data.map((r) => (
        <RecipeSummaryRow key={r.id} recipe={r} onPress={() => router.push(`/recipes/${r.id}`)} />
      ))}
    </View>
  );
}

function Generated() {
  const s = useAsync(() => listGeneratedRecipes(60));
  if (s.loading) return <LoadingState />;
  if (s.error) return <ErrorState error={s.error} onRetry={s.reload} />;
  if (!s.data?.length)
    return <EmptyState emoji="📜" title="Nenhuma receita gerada" message="As receitas sugeridas pela IA ficam salvas aqui." />;
  return (
    <View style={{ gap: Spacing.sm }}>
      {s.data.map((r) => (
        <RecipeSummaryRow key={r.id} recipe={r} subtitle={formatDateBR(r.created_at)} onPress={() => router.push(`/recipes/${r.id}`)} />
      ))}
    </View>
  );
}

function Cooked() {
  const s = useAsync(listCooked);
  if (s.loading) return <LoadingState />;
  if (s.error) return <ErrorState error={s.error} onRetry={s.reload} />;
  if (!s.data?.length)
    return <EmptyState emoji="👩‍🍳" title="Nada preparado ainda" message={'Ao fazer uma receita, toque em "Preparei" para registrar aqui.'} />;
  return (
    <View style={{ gap: Spacing.sm }}>
      {s.data.map((c) => (
        <RecipeSummaryRow
          key={c.id}
          recipe={c.recipe}
          subtitle={`feita em ${formatDateBR(c.cooked_at)}`}
          onPress={() => router.push(`/recipes/${c.recipe.id}`)}
        />
      ))}
    </View>
  );
}

function Scans() {
  const s = useAsync(() => listScans(20));
  if (s.loading) return <LoadingState />;
  if (s.error) return <ErrorState error={s.error} onRetry={s.reload} />;
  if (!s.data?.length)
    return <EmptyState emoji="📸" title="Nenhuma análise ainda" message="As listas de ingredientes das suas fotos aparecem aqui (as fotos não são guardadas)." />;
  return (
    <View style={{ gap: Spacing.sm }}>
      {s.data.map((scan) => (
        <Card key={scan.id} style={{ gap: Spacing.sm }}>
          <AppText variant="bodyStrong">Análise de {formatDateBR(scan.created_at)}</AppText>
          <AppText variant="caption" color={Colors.textSecondary} numberOfLines={3}>
            {scan.ingredients.map((i) => `${categoryEmoji(i.category)} ${i.name}`).join('  ')}
          </AppText>
          <Button
            title="Usar estes ingredientes"
            size="sm"
            variant="secondary"
            icon="refresh"
            disabled={!scan.ingredients.length}
            onPress={() => {
              flowStore.reset();
              flowStore.set({
                source: 'manual',
                scanId: scan.id,
                review: scan.ingredients.map((i) => ({
                  key: newKey(),
                  name: i.name,
                  quantity: i.quantity_estimate,
                  category: i.category,
                  confidence: null,
                  needsConfirmation: false,
                  location: 'fridge',
                  expiresOn: null,
                })),
              });
              router.push('/scan/review');
            }}
          />
        </Card>
      ))}
    </View>
  );
}
