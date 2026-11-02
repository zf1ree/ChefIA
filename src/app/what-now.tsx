import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { isExpiringSoon, todayIso } from '@shared/expiry';

import { AppText, Card, Chip, ChipGroup, EmptyState, ErrorState, LoadingState, Notice, Screen, Section } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { listFridge } from '@/services/fridge';
import { flowStore, newKey } from '@/state/flow-store';

type Preset = 'quick' | 'cheap' | 'expiring' | 'complete' | 'no_shopping';

const MODES: { preset: Preset; emoji: string; title: string; subtitle: string }[] = [
  { preset: 'quick', emoji: '⚡', title: 'Quero cozinhar em até 15 minutos', subtitle: 'Receitas rápidas e práticas' },
  { preset: 'no_shopping', emoji: '🏠', title: 'Só com o que tenho, sem ir ao mercado', subtitle: 'Nada para comprar' },
  { preset: 'cheap', emoji: '💰', title: 'Quero gastar o mínimo possível', subtitle: 'Receitas econômicas, no máximo 1 compra' },
  { preset: 'expiring', emoji: '⏳', title: 'Usar o que está perto de vencer', subtitle: 'Evite desperdício' },
  { preset: 'complete', emoji: '🍽️', title: 'Quero uma refeição completa', subtitle: 'Prato principal com acompanhamento' },
];

export default function WhatNow() {
  const fridge = useAsync(listFridge, [], { reloadOnFocus: false });
  // null = todos os itens selecionados (padrão)
  const [selection, setSelected] = useState<Set<string> | null>(null);
  const today = todayIso();

  if (fridge.loading) return <LoadingState />;
  if (fridge.error) return <ErrorState error={fridge.error} onRetry={fridge.reload} />;
  const items = fridge.data ?? [];
  const selected = selection ?? new Set(items.map((i) => i.id));

  if (!items.length) {
    return (
      <Screen scroll={false}>
        <EmptyState
          emoji="🧊"
          title="Cadastre seus ingredientes"
          message="Este modo usa os itens de Minha Geladeira. Fotografe a geladeira ou adicione itens manualmente."
          actionLabel="Adicionar ingrediente"
          onAction={() => router.push('/fridge/new')}
        />
      </Screen>
    );
  }

  const expiringCount = items.filter((i) => isExpiringSoon(i.expires_on, today)).length;

  function go(preset: Preset) {
    const chosen = items.filter((i) => selected.has(i.id));
    flowStore.reset();
    flowStore.set({
      source: 'fridge',
      review: chosen.map((i) => ({
        key: newKey(),
        name: i.name,
        quantity: i.quantity,
        category: i.category,
        confidence: null,
        needsConfirmation: false,
        location: i.location,
        expiresOn: i.expires_on,
      })),
    });
    router.push({ pathname: '/recipes/generate', params: { preset } });
  }

  return (
    <Screen>
      <AppText color={Colors.textSecondary}>
        Sugestões com base em {selected.size} {selected.size === 1 ? 'item' : 'itens'} da sua geladeira, sem precisar de foto.
      </AppText>

      <View style={{ gap: Spacing.sm }}>
        {MODES.map((m) => {
          const disabled = !selected.size || (m.preset === 'expiring' && expiringCount === 0);
          return (
            <Card key={m.preset} onPress={disabled ? undefined : () => go(m.preset)} style={[styles.mode, disabled && { opacity: 0.5 }]} accessibilityLabel={m.title}>
              <View style={styles.emoji}>
                <AppText style={{ fontSize: 26, lineHeight: 32 }}>{m.emoji}</AppText>
              </View>
              <View style={{ flex: 1 }}>
                <AppText variant="bodyStrong">{m.title}</AppText>
                <AppText variant="caption" color={Colors.textSecondary}>
                  {m.preset === 'expiring' && expiringCount === 0 ? 'Nenhum item com validade próxima cadastrada' : m.subtitle}
                </AppText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </Card>
          );
        })}
      </View>

      <Section title="Ingredientes considerados" action={
        <AppText
          variant="captionStrong"
          color={Colors.primary}
          onPress={() => setSelected(selected.size === items.length ? new Set() : new Set(items.map((i) => i.id)))}>
          {selected.size === items.length ? 'Desmarcar todos' : 'Marcar todos'}
        </AppText>
      }>
        <ChipGroup>
          {items.map((i) => (
            <Chip
              key={i.id}
              label={i.name}
              selected={selected.has(i.id)}
              icon={isExpiringSoon(i.expires_on, today) ? 'hourglass-outline' : undefined}
              onPress={() => {
                const next = new Set(selected);
                if (next.has(i.id)) next.delete(i.id);
                else next.add(i.id);
                setSelected(next);
              }}
            />
          ))}
        </ChipGroup>
        {!selected.size ? <Notice tone="warning">Selecione pelo menos um ingrediente.</Notice> : null}
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mode: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  emoji: { width: 48, height: 48, borderRadius: Radius.md, backgroundColor: Colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
