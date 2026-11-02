import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { TIER_LABELS } from '@shared/ranking';
import type { RecipeTag, StoredRecipe } from '@shared/schemas';

import { RecipeCard } from '@/components/recipe-card';
import { AppText, Badge, Button, Chip, ChipGroup, EmptyState, ErrorState, LoadingState, Notice, Screen, Section } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { AppError, generateRecipes, toAppError } from '@/lib/api';
import { TAG_LABELS } from '@/lib/labels';
import { flowStore, useFlow } from '@/state/flow-store';

export default function Results() {
  const { lastResult, lastRequest } = useFlow();
  const [tagFilter, setTagFilter] = useState<RecipeTag | null>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  const recipes = useMemo(() => lastResult?.recipes ?? [], [lastResult]);
  const availableTags = useMemo(() => [...new Set(recipes.flatMap((r) => r.tags))], [recipes]);
  const visible = tagFilter ? recipes.filter((r) => r.tags.includes(tagFilter)) : recipes;
  const groups = useMemo(() => {
    const map = new Map<StoredRecipe['tier'], StoredRecipe[]>();
    for (const r of visible) map.set(r.tier, [...(map.get(r.tier) ?? []), r]);
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [visible]);

  async function regenerate(patch?: Partial<NonNullable<typeof lastRequest>>) {
    if (!lastRequest) return;
    setError(null);
    setRegenerating(true);
    try {
      const request = { ...lastRequest, ...patch };
      const result = await generateRecipes(request);
      flowStore.set({ lastRequest: request, lastResult: result });
      setTagFilter(null);
    } catch (err) {
      setError(toAppError(err));
    } finally {
      setRegenerating(false);
    }
  }

  if (!lastResult) {
    return (
      <Screen scroll={false}>
        <EmptyState emoji="🍽️" title="Nenhuma busca recente" message="Fotografe sua geladeira ou monte uma lista para gerar receitas." actionLabel="Voltar ao início" onAction={() => router.replace('/')} />
      </Screen>
    );
  }

  if (regenerating) return <Screen scroll={false}><LoadingState message="Criando e validando novas receitas com IA…" /></Screen>;

  return (
    <Screen>
      {error ? <ErrorState error={error} onRetry={() => regenerate()} /> : null}

      {lastResult.removed_for_safety > 0 ? (
        <Notice tone="warning" icon="shield-checkmark">
          {`${lastResult.removed_for_safety} ${lastResult.removed_for_safety === 1 ? 'sugestão foi removida' : 'sugestões foram removidas'} por conflitar com suas alergias, restrições ou itens que você evita.`}
        </Notice>
      ) : null}

      {recipes.length === 0 ? (
        <View style={{ gap: Spacing.md }}>
          <EmptyState
            emoji="🤔"
            title="Não encontramos boas receitas"
            message={
              lastRequest?.shopping === 'none'
                ? 'Com apenas esses ingredientes ficou difícil. Que tal aceitar comprar 1 ou 2 itens?'
                : 'Tente adicionar mais ingredientes ou relaxar os filtros.'
            }
          />
          {lastRequest?.shopping !== 'few' && lastRequest?.shopping !== 'any' ? (
            <Button title="Aceitar comprar até 3 itens" variant="secondary" onPress={() => regenerate({ shopping: 'few' })} />
          ) : null}
          <Button title="Tentar novamente" icon="refresh" onPress={() => regenerate()} />
          <Button title="Editar ingredientes" variant="ghost" onPress={() => router.back()} />
        </View>
      ) : (
        <>
          <View style={{ gap: 2 }}>
            <AppText variant="title">{recipes.length === 1 ? '1 receita encontrada' : `${recipes.length} receitas encontradas`}</AppText>
            <AppText color={Colors.textSecondary}>Ordenadas pelo que você já tem em casa.</AppText>
          </View>

          {availableTags.length > 1 ? (
            <ChipGroup>
              <Chip label="Todas" selected={tagFilter === null} onPress={() => setTagFilter(null)} />
              {availableTags.map((t) => (
                <Chip key={t} label={TAG_LABELS[t]} selected={tagFilter === t} onPress={() => setTagFilter(t)} />
              ))}
            </ChipGroup>
          ) : null}

          {groups.map(([tier, list]) => (
            <Section key={tier} title={TIER_LABELS[tier]} action={<Badge tone={tier === 1 ? 'success' : tier === 4 ? 'danger' : 'warning'} label={String(list.length)} />}>
              {list.map((r) => (
                <RecipeCard key={r.id} recipe={r} onPress={() => router.push(`/recipes/${r.id}`)} />
              ))}
            </Section>
          ))}

          {visible.length === 0 ? (
            <AppText color={Colors.textSecondary} center>
              Nenhuma receita com esse filtro.
            </AppText>
          ) : null}

          <Button title="Gerar outras sugestões" icon="refresh" variant="outline" onPress={() => regenerate()} />
          {lastResult.notes ? (
            <AppText variant="caption" color={Colors.textMuted}>
              Observação da IA: {lastResult.notes}
            </AppText>
          ) : null}
          <AppText variant="caption" color={Colors.textMuted}>
            Uso de hoje: {lastResult.quota.used}/{lastResult.quota.limit} gerações de receitas.
          </AppText>
        </>
      )}
    </Screen>
  );
}
