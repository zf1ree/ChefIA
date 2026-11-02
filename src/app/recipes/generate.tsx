import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Switch, View } from 'react-native';

import { normalizeName } from '@shared/normalize';
import { ALLERGY_OPTIONS, RESTRICTION_OPTIONS } from '@shared/safety';
import { MEAL_TYPES, RECIPE_TAGS, type GenerateRecipesRequest, type MealType, type RecipeTag, type ShoppingMode } from '@shared/schemas';

import { AppText, Button, Card, Chip, ChipGroup, ErrorState, Notice, ProgressSteps, Screen, Section, SegmentedControl, Stepper } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { AppError, generateRecipes, toAppError } from '@/lib/api';
import { MEAL_EMOJI, MEAL_LABELS, TAG_LABELS } from '@/lib/labels';
import { useAuth } from '@/providers/auth-provider';
import { STAPLE_SUGGESTIONS, updateProfile } from '@/services/profile';
import { flowStore, useFlow } from '@/state/flow-store';

type GeneratePreset = 'quick' | 'cheap' | 'expiring' | 'complete' | 'no_shopping';

const TIME_OPTIONS: { label: string; value: number | null }[] = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 hora', value: 60 },
  { label: 'Sem limite', value: null },
];

const SHOPPING_OPTIONS: { value: ShoppingMode; label: string }[] = [
  { value: 'none', label: 'Sem mercado' },
  { value: 'one', label: 'Até 1 item' },
  { value: 'few', label: 'Até 3' },
  { value: 'any', label: 'Tanto faz' },
];

const STEPS = ['Preparando ingredientes e preferências', 'Criando e validando receitas com IA', 'Organizando por relevância'];

function labelFor(key: string): string {
  return (
    ALLERGY_OPTIONS.find((o) => o.key === key)?.label ??
    RESTRICTION_OPTIONS.find((o) => o.key === key)?.label ??
    key
  );
}

export default function Generate() {
  const { preset } = useLocalSearchParams<{ preset?: GeneratePreset }>();
  const { profile, setProfile, session } = useAuth();
  const flow = useFlow();

  const [mealType, setMealType] = useState<MealType | null>(null);
  const [tags, setTags] = useState<RecipeTag[]>(preset === 'cheap' ? ['economica'] : preset === 'complete' ? ['refeicao_completa'] : []);
  const [maxMinutes, setMaxMinutes] = useState<number | null>(preset === 'quick' ? 15 : (profile?.max_cooking_minutes ?? null));
  const [servings, setServings] = useState(profile?.default_servings ?? 2);
  const [shopping, setShopping] = useState<ShoppingMode>(preset === 'no_shopping' ? 'none' : preset === 'cheap' ? 'one' : 'few');
  const [prioritizeExpiring, setPrioritizeExpiring] = useState(preset === 'expiring');
  const [phase, setPhase] = useState<'form' | 'loading'>('form');
  const [step, setStep] = useState(0);
  const [error, setError] = useState<AppError | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const staples = profile?.pantry_staples ?? [];
  const safety = [...(profile?.allergies ?? []), ...(profile?.dietary_restrictions ?? [])];

  async function toggleStaple(name: string) {
    if (!profile || !session) return;
    const has = staples.some((s) => normalizeName(s) === normalizeName(name));
    const next = has ? staples.filter((s) => normalizeName(s) !== normalizeName(name)) : [...staples, name];
    setProfile({ ...profile, pantry_staples: next });
    try {
      setProfile(await updateProfile(session.user.id, { pantry_staples: next }));
    } catch {
      setProfile(profile);
    }
  }

  async function run() {
    setError(null);
    setPhase('loading');
    setStep(0);
    const request: GenerateRecipesRequest = {
      ingredients: flow.review.map((i) => ({ name: i.name, quantity: i.quantity, expires_on: i.expiresOn })),
      meal_type: mealType,
      tags,
      max_minutes: maxMinutes,
      servings,
      shopping,
      prioritize_expiring: prioritizeExpiring,
      scan_id: flow.source === 'scan' ? flow.scanId : null,
    };
    try {
      setStep(1);
      const result = await generateRecipes(request);
      if (!alive.current) return;
      setStep(2);
      flowStore.set({ lastRequest: request, lastResult: result });
      router.replace('/recipes/results');
    } catch (err) {
      if (!alive.current) return;
      setError(toAppError(err));
      setPhase('form');
    }
  }

  if (!flow.review.length) {
    return (
      <Screen>
        <Notice tone="warning">Nenhum ingrediente selecionado. Volte e monte sua lista.</Notice>
        <Button title="Voltar" onPress={() => router.back()} />
      </Screen>
    );
  }

  if (phase === 'loading') {
    return (
      <Screen>
        <Card style={{ gap: Spacing.lg, marginTop: Spacing.xl }}>
          <AppText style={{ fontSize: 48, lineHeight: 56, textAlign: 'center' }}>👩‍🍳</AppText>
          <AppText variant="title" center>
            Preparando sugestões para você
          </AppText>
          <ProgressSteps steps={STEPS} current={step} />
          <AppText variant="caption" color={Colors.textMuted}>
            Usando {flow.review.length} ingredientes. Costuma levar de 10 a 40 segundos.
          </AppText>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen
      footer={<Button title="Gerar receitas" icon="sparkles" size="lg" fullWidth onPress={run} />}>
      {error ? (
        <Card style={{ borderColor: Colors.danger }}>
          <ErrorState error={error} onRetry={run} />
        </Card>
      ) : null}

      <View style={{ gap: 2 }}>
        <AppText variant="title">Como vai ser?</AppText>
        <AppText color={Colors.textSecondary}>
          {flow.review.length} ingredientes: {flow.review.slice(0, 5).map((i) => i.name).join(', ')}
          {flow.review.length > 5 ? '…' : ''}
        </AppText>
      </View>

      <Section title="Refeição">
        <ChipGroup>
          <Chip label="Qualquer" selected={mealType === null} onPress={() => setMealType(null)} />
          {MEAL_TYPES.map((m) => (
            <Chip key={m} emoji={MEAL_EMOJI[m]} label={MEAL_LABELS[m]} selected={mealType === m} onPress={() => setMealType(m)} />
          ))}
        </ChipGroup>
      </Section>

      <Section title="Tempo disponível">
        <ChipGroup>
          {TIME_OPTIONS.map((t) => (
            <Chip key={t.label} label={t.label} selected={maxMinutes === t.value} onPress={() => setMaxMinutes(t.value)} />
          ))}
        </ChipGroup>
      </Section>

      <Section title="Pessoas" action={<Stepper label="pessoas" value={servings} onChange={setServings} />}>
        <View />
      </Section>

      <Section title="Ir ao mercado?">
        <SegmentedControl options={SHOPPING_OPTIONS} value={shopping} onChange={setShopping} />
      </Section>

      <Section title="Estilo (opcional)">
        <ChipGroup>
          {RECIPE_TAGS.map((t) => (
            <Chip
              key={t}
              label={TAG_LABELS[t]}
              selected={tags.includes(t)}
              onPress={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}
            />
          ))}
        </ChipGroup>
      </Section>

      <Card style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
        <View style={{ flex: 1 }}>
          <AppText variant="bodyStrong">Priorizar itens perto do vencimento</AppText>
          <AppText variant="caption" color={Colors.textSecondary}>
            Usa as datas de validade que você informou.
          </AppText>
        </View>
        <Switch
          value={prioritizeExpiring}
          onValueChange={setPrioritizeExpiring}
          trackColor={{ true: Colors.primary, false: Colors.border }}
          accessibilityLabel="Priorizar itens perto do vencimento"
        />
      </Card>

      <Section title="Básicos que você tem em casa">
        <AppText variant="caption" color={Colors.textSecondary}>
          Não presumimos que você tem sal, óleo ou temperos. Marque o que realmente tem:
        </AppText>
        <ChipGroup>
          {[...new Set([...STAPLE_SUGGESTIONS.slice(0, 8), ...staples])].map((s) => (
            <Chip
              key={s}
              label={s}
              icon={staples.some((x) => normalizeName(x) === normalizeName(s)) ? 'checkmark' : undefined}
              selected={staples.some((x) => normalizeName(x) === normalizeName(s))}
              onPress={() => toggleStaple(s)}
            />
          ))}
        </ChipGroup>
      </Section>

      {safety.length ? (
        <Notice tone="warning" icon="shield-checkmark">
          {`Receitas filtradas para: ${safety.map(labelFor).join(', ')}. Sempre confira rótulos — a IA não garante ausência de contaminação cruzada.`}
        </Notice>
      ) : (
        <Notice icon="shield-outline">
          Nenhuma alergia ou restrição cadastrada. Você pode configurar em Perfil → Preferências alimentares.
        </Notice>
      )}
    </Screen>
  );
}
