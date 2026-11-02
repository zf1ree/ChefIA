import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';

import { normalizeName } from '@shared/normalize';
import { LOCATIONS, type StorageLocation } from '@shared/schemas';

import { ExpiryPicker } from '@/components/expiry-picker';
import { AppText, Badge, Button, Card, Chip, ChipGroup, IconButton, InlineError, Notice, Screen, TextField } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { toAppError } from '@/lib/api';
import { LOCATION_LABELS, categoryEmoji } from '@/lib/labels';
import { filterCatalog, getCatalog, type CatalogIngredient } from '@/services/catalog';
import { addManyToFridge } from '@/services/fridge';
import { flowStore, newKey, useFlow, type ReviewItem } from '@/state/flow-store';

export default function Review() {
  const flow = useFlow();
  const items = flow.review;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [catalog, setCatalog] = useState<CatalogIngredient[]>([]);
  const [saveToFridge, setSaveToFridge] = useState(flow.source === 'scan');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => {});
  }, []);

  const setItems = (next: ReviewItem[]) => flowStore.set({ review: next });
  const update = (key: string, patch: Partial<ReviewItem>) =>
    setItems(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const remove = (key: string) => setItems(items.filter((i) => i.key !== key));

  const suggestions = useMemo(() => {
    if (!newName.trim()) return [];
    const have = new Set(items.map((i) => normalizeName(i.name)));
    return filterCatalog(catalog, newName)
      .filter((c) => !have.has(normalizeName(c.name)))
      .slice(0, 6);
  }, [newName, catalog, items]);

  function add(name: string, fromCatalog?: CatalogIngredient) {
    const clean = name.trim();
    if (!clean) return;
    if (items.some((i) => normalizeName(i.name) === normalizeName(clean))) {
      setError(`"${clean}" já está na lista.`);
      return;
    }
    setError(null);
    setItems([
      ...items,
      {
        key: newKey(),
        name: clean.charAt(0).toUpperCase() + clean.slice(1),
        quantity: null,
        category: fromCatalog?.category ?? 'outros',
        confidence: null,
        needsConfirmation: false,
        location: fromCatalog?.default_location ?? 'fridge',
        expiresOn: null,
      },
    ]);
    setNewName('');
  }

  const pendingConfirm = items.filter((i) => i.needsConfirmation);

  async function next() {
    setError(null);
    if (pendingConfirm.length) {
      setError('Confirme ou remova os itens marcados como incertos antes de continuar.');
      return;
    }
    if (!items.length) {
      setError('Adicione pelo menos um ingrediente.');
      return;
    }
    if (saveToFridge) {
      setSaving(true);
      try {
        await addManyToFridge(
          items.map((i) => ({ name: i.name, quantity: i.quantity, category: i.category, location: i.location, expires_on: i.expiresOn })),
          flow.source === 'scan' ? 'scan' : 'manual',
        );
      } catch (err) {
        setSaving(false);
        setError(`Não foi possível salvar na geladeira: ${toAppError(err).message}`);
        return;
      }
      setSaving(false);
    }
    router.push('/recipes/generate');
  }

  return (
    <Screen
      footer={
        <View style={{ width: '100%', gap: Spacing.sm }}>
          <View style={styles.saveRow}>
            <AppText variant="caption" color={Colors.textSecondary} style={{ flex: 1 }}>
              Salvar estes itens em Minha Geladeira
            </AppText>
            <Switch
              value={saveToFridge}
              onValueChange={setSaveToFridge}
              trackColor={{ true: Colors.primary, false: Colors.border }}
              accessibilityLabel="Salvar em Minha Geladeira"
            />
          </View>
          <Button
            title={items.length ? `Continuar com ${items.length} ${items.length === 1 ? 'ingrediente' : 'ingredientes'}` : 'Continuar'}
            icon="arrow-forward"
            size="lg"
            fullWidth
            loading={saving}
            disabled={!items.length}
            onPress={next}
          />
        </View>
      }>
      {flow.source === 'scan' && flow.photoUri ? (
        <View style={styles.header}>
          <Image source={{ uri: flow.photoUri }} style={styles.thumb} contentFit="cover" accessibilityLabel="Foto analisada" />
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="heading">{items.length} ingredientes encontrados</AppText>
            <AppText variant="caption" color={Colors.textSecondary}>
              Toque em um item para editar. Remova o que estiver errado.
            </AppText>
          </View>
        </View>
      ) : (
        <View style={{ gap: 2 }}>
          <AppText variant="title">Quais ingredientes você tem?</AppText>
          <AppText color={Colors.textSecondary}>Monte a lista para gerar receitas.</AppText>
        </View>
      )}

      {flow.scanNotes ? <Notice>{flow.scanNotes}</Notice> : null}
      {pendingConfirm.length ? (
        <Notice tone="warning" icon="help-circle">
          {`A IA não teve certeza sobre ${pendingConfirm.length === 1 ? '1 item' : `${pendingConfirm.length} itens`}. Confirme se você realmente tem ou remova.`}
        </Notice>
      ) : null}

      <View style={{ gap: Spacing.sm }}>
        {items.map((item) => (
          <ReviewRow
            key={item.key}
            item={item}
            expanded={expanded === item.key}
            onToggle={() => setExpanded(expanded === item.key ? null : item.key)}
            onChange={(patch) => update(item.key, patch)}
            onRemove={() => remove(item.key)}
          />
        ))}
      </View>

      <Card style={{ gap: Spacing.md }}>
        <AppText variant="bodyStrong">Adicionar ingrediente</AppText>
        <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <TextField
              placeholder="Ex.: cebola, arroz, frango…"
              value={newName}
              onChangeText={(t) => {
                setNewName(t);
                setError(null);
              }}
              onSubmitEditing={() => add(newName)}
              returnKeyType="done"
              maxLength={60}
            />
          </View>
          <Button title="Adicionar" icon="add" onPress={() => add(newName)} disabled={!newName.trim()} />
        </View>
        {suggestions.length ? (
          <ChipGroup>
            {suggestions.map((s) => (
              <Chip key={s.id} label={s.name} emoji={categoryEmoji(s.category)} onPress={() => add(s.name, s)} />
            ))}
          </ChipGroup>
        ) : null}
      </Card>

      {error ? <InlineError message={error} /> : null}
    </Screen>
  );
}

function ReviewRow({
  item,
  expanded,
  onToggle,
  onChange,
  onRemove,
}: {
  item: ReviewItem;
  expanded: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<ReviewItem>) => void;
  onRemove: () => void;
}) {
  return (
    <Card padded={false} style={item.needsConfirmation ? { borderColor: Colors.amber, borderWidth: 1 } : undefined}>
      <Pressable onPress={onToggle} style={styles.row} accessibilityRole="button" accessibilityLabel={`Editar ${item.name}`}>
        <AppText style={{ fontSize: 24, lineHeight: 30 }}>{categoryEmoji(item.category)}</AppText>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {item.name}
          </AppText>
          <View style={{ flexDirection: 'row', gap: Spacing.xs, flexWrap: 'wrap' }}>
            {item.quantity ? (
              <AppText variant="caption" color={Colors.textSecondary}>
                {item.quantity}
              </AppText>
            ) : null}
            {item.needsConfirmation ? <Badge tone="warning" label="Incerto" icon="help" /> : null}
            {item.confidence !== null && !item.needsConfirmation ? (
              <Badge tone="success" label={`${Math.round(item.confidence * 100)}% de certeza`} />
            ) : null}
          </View>
        </View>
        {item.needsConfirmation ? (
          <Button title="Tenho" size="sm" variant="secondary" icon="checkmark" onPress={() => onChange({ needsConfirmation: false })} />
        ) : null}
        <IconButton icon="trash-outline" label={`Remover ${item.name}`} color={Colors.danger} onPress={onRemove} />
      </Pressable>

      {expanded ? (
        <View style={styles.editor}>
          <TextField label="Nome" value={item.name} onChangeText={(t) => onChange({ name: t })} maxLength={60} />
          <TextField
            label="Quantidade (opcional)"
            value={item.quantity ?? ''}
            placeholder="Ex.: 6 unidades, 500 g"
            onChangeText={(t) => onChange({ quantity: t || null })}
            maxLength={40}
          />
          <View style={{ gap: Spacing.xs }}>
            <AppText variant="captionStrong" color={Colors.textSecondary}>
              Onde fica
            </AppText>
            <ChipGroup>
              {LOCATIONS.map((l: StorageLocation) => (
                <Chip key={l} label={LOCATION_LABELS[l]} selected={item.location === l} onPress={() => onChange({ location: l })} />
              ))}
            </ChipGroup>
          </View>
          <ExpiryPicker value={item.expiresOn} onChange={(iso) => onChange({ expiresOn: iso })} />
          <Button title="Pronto" variant="secondary" onPress={onToggle} />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  thumb: { width: 64, height: 64, borderRadius: Radius.md, backgroundColor: Colors.surfaceMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  editor: { gap: Spacing.md, padding: Spacing.md, paddingTop: 0 },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
});
