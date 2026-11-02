// Detalhes, criação e edição de um ingrediente de "Minha Geladeira".
// /fridge/new cria um item (digitando ou escolhendo do catálogo).
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Platform, View } from 'react-native';

import { CATEGORIES, LOCATIONS, type Category, type StorageLocation } from '@shared/schemas';

import { ExpiryPicker } from '@/components/expiry-picker';
import { AppText, Button, Chip, ChipGroup, ErrorState, InlineError, LoadingState, Screen, Section, TextField } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { toAppError } from '@/lib/api';
import { CATEGORY_EMOJI, CATEGORY_LABELS, LOCATION_LABELS, formatDateBR } from '@/lib/labels';
import { filterCatalog, getCatalog, type CatalogIngredient } from '@/services/catalog';
import { createFridgeItem, deleteFridgeItem, getFridgeItem, updateFridgeItem, type FridgeItem } from '@/services/fridge';

interface FormState {
  name: string;
  quantity: string;
  category: Category;
  location: StorageLocation;
  expires_on: string | null;
  notes: string;
  ingredient_id: number | null;
}

const EMPTY: FormState = { name: '', quantity: '', category: 'outros', location: 'fridge', expires_on: null, notes: '', ingredient_id: null };

export default function FridgeItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const [item, setItem] = useState<FridgeItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<CatalogIngredient[]>([]);

  useEffect(() => {
    getCatalog().then(setCatalog).catch(() => {});
    if (isNew) return;
    getFridgeItem(id)
      .then((it) => {
        setItem(it);
        setForm({
          name: it.name,
          quantity: it.quantity ?? '',
          category: (CATEGORIES as readonly string[]).includes(it.category) ? (it.category as Category) : 'outros',
          location: it.location,
          expires_on: it.expires_on,
          notes: it.notes ?? '',
          ingredient_id: it.ingredient_id,
        });
      })
      .catch((err) => setLoadError(toAppError(err)))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const suggestions = useMemo(
    () => (isNew && form.name.trim() && !form.ingredient_id ? filterCatalog(catalog, form.name).slice(0, 8) : []),
    [isNew, form.name, form.ingredient_id, catalog],
  );
  const popular = useMemo(() => (isNew && !form.name.trim() ? catalog.slice(0, 16) : []), [isNew, form.name, catalog]);

  const set = (patch: Partial<FormState>) => {
    setForm((f) => ({ ...f, ...patch }));
    setError(null);
  };

  function pick(c: CatalogIngredient) {
    set({
      name: c.name,
      category: (CATEGORIES as readonly string[]).includes(c.category) ? (c.category as Category) : 'outros',
      location: c.default_location,
      ingredient_id: c.id,
    });
  }

  async function save() {
    if (!form.name.trim()) return setError('Informe o nome do ingrediente.');
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      quantity: form.quantity.trim() || null,
      category: form.category,
      location: form.location,
      expires_on: form.expires_on,
      notes: form.notes.trim() || null,
      ingredient_id: form.ingredient_id,
    };
    try {
      if (isNew) await createFridgeItem({ ...payload, source: form.ingredient_id ? 'catalog' : 'manual' });
      else await updateFridgeItem(id, payload);
      router.back();
    } catch (err) {
      setError(toAppError(err).message);
    } finally {
      setSaving(false);
    }
  }

  async function doDelete() {
    setSaving(true);
    try {
      await deleteFridgeItem(id);
      router.back();
    } catch (err) {
      setError(toAppError(err).message);
      setSaving(false);
    }
  }

  function confirmDelete() {
    const msg = `Remover "${form.name}" da sua geladeira?`;
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) doDelete();
      return;
    }
    Alert.alert('Remover ingrediente', msg, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: doDelete },
    ]);
  }

  if (loading) return <LoadingState />;
  if (loadError) return <ErrorState error={loadError} />;

  return (
    <>
      <Stack.Screen options={{ title: isNew ? 'Adicionar ingrediente' : 'Editar ingrediente' }} />
      <Screen
        footer={
          <View style={{ width: '100%', gap: Spacing.sm }}>
            <Button title={isNew ? 'Adicionar à geladeira' : 'Salvar alterações'} size="lg" fullWidth loading={saving} onPress={save} />
            {!isNew ? <Button title="Remover" variant="danger" fullWidth icon="trash-outline" onPress={confirmDelete} disabled={saving} /> : null}
          </View>
        }>
        <TextField
          label="Nome"
          value={form.name}
          placeholder="Digite ou escolha da lista"
          onChangeText={(t) => set({ name: t, ingredient_id: null })}
          maxLength={80}
          autoFocus={isNew}
        />
        {suggestions.length || popular.length ? (
          <ChipGroup>
            {(suggestions.length ? suggestions : popular).map((c) => (
              <Chip key={c.id} label={c.name} emoji={CATEGORY_EMOJI[c.category as Category] ?? '🧺'} onPress={() => pick(c)} />
            ))}
          </ChipGroup>
        ) : null}

        <TextField label="Quantidade aproximada" value={form.quantity} placeholder="Ex.: 6 unidades, 1 kg, meio pacote" onChangeText={(t) => set({ quantity: t })} maxLength={40} />

        <Section title="Onde fica">
          <ChipGroup>
            {LOCATIONS.map((l) => (
              <Chip key={l} label={LOCATION_LABELS[l]} selected={form.location === l} onPress={() => set({ location: l })} />
            ))}
          </ChipGroup>
        </Section>

        <Section title="Categoria">
          <ChipGroup>
            {CATEGORIES.map((c) => (
              <Chip key={c} emoji={CATEGORY_EMOJI[c]} label={CATEGORY_LABELS[c]} selected={form.category === c} onPress={() => set({ category: c })} />
            ))}
          </ChipGroup>
        </Section>

        <ExpiryPicker value={form.expires_on} onChange={(iso) => set({ expires_on: iso })} />

        <TextField label="Observações" value={form.notes} placeholder="Ex.: aberto, metade usada" onChangeText={(t) => set({ notes: t })} multiline maxLength={500} />

        {item ? (
          <AppText variant="caption" color={Colors.textMuted}>
            Cadastrado em {formatDateBR(item.created_at)}
            {item.source === 'scan' ? ' a partir de uma foto' : ''}.
          </AppText>
        ) : null}

        {error ? <InlineError message={error} /> : null}
      </Screen>
    </>
  );
}
