import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { expiryLabel, expiryStatus, todayIso } from '@shared/expiry';
import type { StorageLocation } from '@shared/schemas';

import { AppText, Badge, Button, Card, EmptyState, ErrorState, IconButton, LoadingState, Notice, Screen, SegmentedControl } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { LOCATION_ICONS, LOCATION_LABELS, categoryEmoji } from '@/lib/labels';
import { listFridge, type FridgeItem } from '@/services/fridge';
import { flowStore } from '@/state/flow-store';

type Filter = 'all' | StorageLocation;

export default function Fridge() {
  const fridge = useAsync(listFridge);
  const [filter, setFilter] = useState<Filter>('all');
  const today = todayIso();

  const items = fridge.data ?? [];
  const visible = filter === 'all' ? items : items.filter((i) => i.location === filter);
  const attention = items.filter((i) => ['expired', 'today', 'soon'].includes(expiryStatus(i.expires_on, today)));

  return (
    <Screen
      safeTop
      title="Minha Geladeira"
      subtitle={items.length ? `${items.length} ${items.length === 1 ? 'item' : 'itens'} cadastrados` : undefined}
      headerRight={<IconButton icon="add-circle" size={30} color={Colors.primary} label="Adicionar ingrediente" onPress={() => router.push('/fridge/new')} />}
      refreshing={fridge.refreshing}
      onRefresh={fridge.refresh}>
      {fridge.loading ? (
        <LoadingState />
      ) : fridge.error ? (
        <ErrorState error={fridge.error} onRetry={fridge.reload} />
      ) : items.length === 0 ? (
        <EmptyState
          emoji="🧊"
          title="Sua geladeira está vazia"
          message="Fotografe sua geladeira ou adicione ingredientes manualmente para receber sugestões sem precisar de foto."
          actionLabel="Adicionar ingrediente"
          onAction={() => router.push('/fridge/new')}
        />
      ) : (
        <>
          {attention.length ? (
            <Notice tone="warning" icon="hourglass-outline">
              {`${attention.length === 1 ? '1 item vence' : `${attention.length} itens vencem`} em breve ou já venceu. Use primeiro!`}
            </Notice>
          ) : null}

          <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
            <Button
              title="Receitas com isso"
              icon="sparkles"
              style={{ flex: 1 }}
              onPress={() => router.push('/what-now')}
            />
            <Button
              title="Fotografar"
              icon="camera-outline"
              variant="outline"
              style={{ flex: 1 }}
              onPress={() => {
                flowStore.reset();
                router.push('/scan/capture');
              }}
            />
          </View>

          <SegmentedControl<Filter>
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'Tudo' },
              { value: 'fridge', label: 'Geladeira' },
              { value: 'freezer', label: 'Congelador' },
              { value: 'pantry', label: 'Despensa' },
            ]}
          />

          <View style={{ gap: Spacing.sm }}>
            {visible.length ? (
              visible.map((item) => <FridgeRow key={item.id} item={item} today={today} />)
            ) : (
              <AppText color={Colors.textSecondary} center>
                Nada em {LOCATION_LABELS[filter as StorageLocation]?.toLowerCase()}.
              </AppText>
            )}
          </View>
        </>
      )}
    </Screen>
  );
}

function FridgeRow({ item, today }: { item: FridgeItem; today: string }) {
  const status = expiryStatus(item.expires_on, today);
  const label = expiryLabel(item.expires_on, today);
  return (
    <Card onPress={() => router.push(`/fridge/${item.id}`)} accessibilityLabel={`${item.name}, ${LOCATION_LABELS[item.location]}${label ? `, ${label}` : ''}`}>
      <View style={styles.row}>
        <AppText style={{ fontSize: 26, lineHeight: 32 }}>{categoryEmoji(item.category)}</AppText>
        <View style={{ flex: 1, gap: 3 }}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {item.name}
          </AppText>
          <View style={styles.meta}>
            <Ionicons name={LOCATION_ICONS[item.location]} size={12} color={Colors.textMuted} />
            <AppText variant="caption" color={Colors.textSecondary}>
              {[LOCATION_LABELS[item.location], item.quantity].filter(Boolean).join(' · ')}
            </AppText>
          </View>
        </View>
        {label ? (
          <Badge
            tone={status === 'expired' ? 'danger' : status === 'today' || status === 'soon' ? 'warning' : 'neutral'}
            label={label}
          />
        ) : null}
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
