import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';

import { covers } from '@shared/normalize';

import { AppText, Button, Card, EmptyState, ErrorState, IconButton, InlineError, LoadingState, Screen, Section, TextField } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { toAppError } from '@/lib/api';
import { categoryEmoji, categoryLabel } from '@/lib/labels';
import { getCatalog } from '@/services/catalog';
import {
  addShoppingItems,
  clearChecked,
  listShoppingItems,
  removeShoppingItem,
  setChecked,
  shoppingShareText,
  type ShoppingItem,
} from '@/services/shopping';

export default function Shopping() {
  const list = useAsync(listShoppingItems);
  const [newItem, setNewItem] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const items = list.data ?? [];
  const pending = items.filter((i) => !i.checked);
  const done = items.filter((i) => i.checked);
  const groups = new Map<string, ShoppingItem[]>();
  for (const i of pending) groups.set(i.category, [...(groups.get(i.category) ?? []), i]);

  async function mutate(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
      await list.refresh();
    } catch (err) {
      setError(toAppError(err).message);
    }
  }

  async function add() {
    const name = newItem.trim();
    if (!name) return;
    setAdding(true);
    setError(null);
    try {
      const catalog = await getCatalog().catch(() => []);
      const category = catalog.find((c) => covers(c.name, name) || covers(name, c.name))?.category ?? 'outros';
      const created = await addShoppingItems([{ name, category }]);
      if (!created) setError(`"${name}" já está na lista.`);
      setNewItem('');
      await list.refresh();
    } catch (err) {
      setError(toAppError(err).message);
    } finally {
      setAdding(false);
    }
  }

  function toggle(item: ShoppingItem) {
    list.setData((prev) => (prev ?? []).map((i) => (i.id === item.id ? { ...i, checked: !i.checked } : i)));
    setChecked(item.id, !item.checked).catch((err) => {
      setError(toAppError(err).message);
      list.refresh();
    });
  }

  return (
    <Screen
      safeTop
      title="Lista de compras"
      subtitle={pending.length ? `${pending.length} ${pending.length === 1 ? 'item pendente' : 'itens pendentes'}` : undefined}
      headerRight={
        pending.length ? (
          <IconButton
            icon="share-outline"
            label="Compartilhar lista"
            onPress={() => Share.share({ message: shoppingShareText(items) }).catch(() => setError('Não foi possível compartilhar.'))}
          />
        ) : undefined
      }
      refreshing={list.refreshing}
      onRefresh={list.refresh}>
      <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <TextField placeholder="Adicionar item…" value={newItem} onChangeText={setNewItem} onSubmitEditing={add} returnKeyType="done" maxLength={80} />
        </View>
        <Button title="Adicionar" icon="add" loading={adding} disabled={!newItem.trim()} onPress={add} />
      </View>
      {error ? <InlineError message={error} /> : null}

      {list.loading ? (
        <LoadingState />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={list.reload} />
      ) : items.length === 0 ? (
        <EmptyState
          emoji="🛒"
          title="Lista vazia"
          message="Adicione itens aqui ou, em uma receita, toque em “Adicionar à lista de compras” para os ingredientes que faltam."
        />
      ) : (
        <>
          {[...groups.entries()].map(([cat, list]) => (
            <Section key={cat} title={`${categoryEmoji(cat)} ${categoryLabel(cat)}`}>
              <Card padded={false}>
                {list.map((i, idx) => (
                  <ItemRow key={i.id} item={i} last={idx === list.length - 1} onToggle={() => toggle(i)} onRemove={() => mutate(() => removeShoppingItem(i.id))} />
                ))}
              </Card>
            </Section>
          ))}

          {done.length ? (
            <Section
              title={`Comprados (${done.length})`}
              action={<Button title="Limpar" size="sm" variant="ghost" onPress={() => mutate(clearChecked)} />}>
              <Card padded={false}>
                {done.map((i, idx) => (
                  <ItemRow key={i.id} item={i} last={idx === done.length - 1} onToggle={() => toggle(i)} onRemove={() => mutate(() => removeShoppingItem(i.id))} />
                ))}
              </Card>
            </Section>
          ) : null}

          <AppText variant="caption" color={Colors.textMuted} center>
            Em breve: estimativa de custos e integração com mercados.
          </AppText>
        </>
      )}
    </Screen>
  );
}

function ItemRow({ item, last, onToggle, onRemove }: { item: ShoppingItem; last: boolean; onToggle: () => void; onRemove: () => void }) {
  return (
    <View style={[styles.row, !last && styles.separator]}>
      <Pressable
        onPress={onToggle}
        style={styles.check}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.checked }}
        accessibilityLabel={item.name}>
        <Ionicons name={item.checked ? 'checkmark-circle' : 'ellipse-outline'} size={26} color={item.checked ? Colors.primary : Colors.textMuted} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong" color={item.checked ? Colors.textMuted : Colors.text} style={item.checked && { textDecorationLine: 'line-through' }}>
            {item.name}
            {item.quantity ? <AppText color={Colors.textSecondary}> · {item.quantity}</AppText> : null}
          </AppText>
          {item.recipe_titles.length ? (
            <AppText variant="caption" color={Colors.textMuted} numberOfLines={1}>
              Para: {item.recipe_titles.join(', ')}
            </AppText>
          ) : null}
        </View>
      </Pressable>
      <IconButton icon="close" label={`Remover ${item.name}`} color={Colors.textMuted} size={18} onPress={onRemove} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: Spacing.md, paddingRight: Spacing.xs, paddingVertical: Spacing.sm },
  separator: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  check: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
});
