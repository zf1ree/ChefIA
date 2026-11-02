import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Share, StyleSheet, View } from 'react-native';

import { covers } from '@shared/normalize';
import { totalMinutes } from '@shared/ranking';
import type { RecipeIngredient, StoredRecipe } from '@shared/schemas';

import { RecipeHero } from '@/components/recipe-card';
import {
  AppText,
  Badge,
  Button,
  Card,
  Divider,
  ErrorState,
  IconButton,
  InlineError,
  LoadingState,
  Notice,
  Screen,
  Section,
  Stepper,
  TextField,
} from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAsync } from '@/hooks/use-async';
import { toAppError } from '@/lib/api';
import { DIFFICULTY_LABELS, MEAL_LABELS, TAG_LABELS, formatMinutes } from '@/lib/labels';
import { getCatalog } from '@/services/catalog';
import {
  getFeedback,
  getRecipe,
  isFavorite,
  markCooked,
  recipeShareText,
  saveFeedback,
  setFavorite,
  timesCooked,
  type Feedback,
} from '@/services/recipes';
import { addShoppingItems } from '@/services/shopping';

function formatQuantity(ing: RecipeIngredient, factor: number): string {
  if (ing.quantity === null || factor === 1) return ing.display_quantity;
  const q = ing.quantity * factor;
  const rounded = q >= 10 ? Math.round(q) : Math.round(q * 4) / 4; // frações de 1/4
  const num = Number.isInteger(rounded) ? String(rounded) : rounded.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return ing.unit ? `${num} ${ing.unit}` : num;
}

export default function RecipeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useAsync(
    async () => {
      const [recipe, fav, feedback, cooked] = await Promise.all([getRecipe(id), isFavorite(id), getFeedback(id), timesCooked(id)]);
      return { recipe, fav, feedback, cooked };
    },
    [id],
    { reloadOnFocus: false },
  );

  if (state.loading) return <LoadingState message="Carregando receita…" />;
  if (state.error || !state.data) return <ErrorState error={state.error ?? new Error('Receita não encontrada.')} onRetry={state.reload} />;
  return (
    <RecipeView
      recipe={state.data.recipe}
      initialFav={state.data.fav}
      initialFeedback={state.data.feedback}
      initialCooked={state.data.cooked}
    />
  );
}

function RecipeView({
  recipe,
  initialFav,
  initialFeedback,
  initialCooked,
}: {
  recipe: StoredRecipe;
  initialFav: boolean;
  initialFeedback: Feedback | null;
  initialCooked: number;
}) {
  const [fav, setFav] = useState(initialFav);
  const [cooked, setCooked] = useState(initialCooked);
  const [servings, setServings] = useState(recipe.servings);
  const [doneSteps, setDoneSteps] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<{ tone: 'success' | 'info'; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addingList, setAddingList] = useState(false);
  const factor = servings / recipe.servings;

  const haveSet = new Set(recipe.have);
  const missingRequired = recipe.missing.filter((m) => !m.optional);

  async function toggleFav() {
    const next = !fav;
    setFav(next);
    try {
      await setFavorite(recipe.id, next);
      if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    } catch (err) {
      setFav(!next);
      setError(toAppError(err).message);
    }
  }

  async function cookedIt() {
    setError(null);
    try {
      await markCooked(recipe.id);
      setCooked((c) => c + 1);
      setMessage({ tone: 'success', text: 'Marcada como preparada! Conte abaixo como ficou — isso melhora suas próximas sugestões.' });
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err) {
      setError(toAppError(err).message);
    }
  }

  async function share() {
    try {
      await Share.share({ message: recipeShareText(recipe), title: recipe.title });
    } catch {
      setError('Não foi possível abrir o compartilhamento neste dispositivo.');
    }
  }

  async function addMissingToList() {
    setAddingList(true);
    setError(null);
    try {
      const catalog = await getCatalog().catch(() => []);
      const created = await addShoppingItems(
        recipe.missing.map((m) => ({
          name: m.name,
          quantity: m.display_quantity,
          category: catalog.find((c) => covers(c.name, m.name) || covers(m.name, c.name))?.category ?? 'outros',
          recipeTitle: recipe.title,
        })),
      );
      setMessage({
        tone: 'success',
        text: created
          ? `${created} ${created === 1 ? 'item adicionado' : 'itens adicionados'} à lista de compras.`
          : 'Os itens já estavam na sua lista de compras.',
      });
    } catch (err) {
      setError(toAppError(err).message);
    } finally {
      setAddingList(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <View style={{ flexDirection: 'row' }}>
              <IconButton icon={fav ? 'heart' : 'heart-outline'} color={fav ? Colors.tomato : Colors.text} label={fav ? 'Remover dos favoritos' : 'Favoritar'} onPress={toggleFav} />
              <IconButton icon="share-outline" label="Compartilhar receita" onPress={share} />
            </View>
          ),
        }}
      />
      <Screen>
        <View style={{ alignItems: 'center', gap: Spacing.md }}>
          <RecipeHero mealType={recipe.meal_type} size={112} />
          <AppText variant="display" center accessibilityRole="header">
            {recipe.title}
          </AppText>
          <AppText color={Colors.textSecondary} center>
            {recipe.description}
          </AppText>
          <View style={styles.badges}>
            <Badge label={MEAL_LABELS[recipe.meal_type]} />
            {recipe.tags.map((t) => (
              <Badge key={t} label={TAG_LABELS[t]} tone="success" />
            ))}
          </View>
        </View>

        <View style={styles.statsRow}>
          <Stat icon="hourglass-outline" label="Preparo" value={formatMinutes(recipe.prep_minutes)} />
          <Stat icon="flame-outline" label="Cozimento" value={formatMinutes(recipe.cook_minutes)} />
          <Stat icon="time-outline" label="Total" value={formatMinutes(totalMinutes(recipe))} />
          <Stat icon="speedometer-outline" label="Nível" value={DIFFICULTY_LABELS[recipe.difficulty]} />
        </View>

        <View style={styles.actions}>
          <Button title={fav ? 'Favorita' : 'Favoritar'} icon={fav ? 'heart' : 'heart-outline'} variant={fav ? 'secondary' : 'outline'} style={{ flex: 1 }} onPress={toggleFav} />
          <Button title={cooked ? `Preparei (${cooked})` : 'Preparei'} icon="checkmark-done" variant="outline" style={{ flex: 1 }} onPress={cookedIt} />
          <Button title="Enviar" icon="share-social-outline" variant="outline" style={{ flex: 1 }} onPress={share} />
        </View>

        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        {error ? <InlineError message={error} /> : null}

        <Section title="Ingredientes" action={<Stepper label="porções" value={servings} onChange={setServings} />}>
          <AppText variant="caption" color={Colors.textSecondary}>
            {servings} {servings === 1 ? 'porção' : 'porções'}
            {factor !== 1 ? ' · quantidades ajustadas automaticamente (confira o bom senso)' : ''}
          </AppText>
          <Card style={{ gap: Spacing.md }}>
            {recipe.ingredients.map((ing, idx) => {
              const has = haveSet.has(ing.name);
              return (
                <View key={`${ing.name}-${idx}`} style={styles.ingRow}>
                  <Ionicons name={has ? 'checkmark-circle' : 'cart-outline'} size={20} color={has ? Colors.primary : Colors.amber} />
                  <AppText style={{ flex: 1 }}>
                    <AppText variant="bodyStrong">{formatQuantity(ing, factor)}</AppText> {ing.name}
                    {ing.optional ? <AppText color={Colors.textMuted}> (opcional)</AppText> : null}
                  </AppText>
                  {!has ? <Badge tone="warning" label="Comprar" /> : null}
                </View>
              );
            })}
          </Card>
          {recipe.missing.length ? (
            <Button
              title={missingRequired.length ? `Adicionar ${recipe.missing.length} à lista de compras` : 'Adicionar opcionais à lista'}
              icon="cart"
              variant="secondary"
              loading={addingList}
              onPress={addMissingToList}
            />
          ) : (
            <Notice tone="success" icon="sparkles">
              Você tem tudo para fazer esta receita.
            </Notice>
          )}
        </Section>

        <Section title="Modo de preparo">
          {recipe.steps.map((s, idx) => (
            <StepCard
              key={idx}
              index={idx}
              text={s.text}
              minutes={s.minutes}
              done={doneSteps.has(idx)}
              onToggle={() => {
                const next = new Set(doneSteps);
                if (next.has(idx)) next.delete(idx);
                else next.add(idx);
                setDoneSteps(next);
              }}
            />
          ))}
        </Section>

        {recipe.nutrition_per_serving ? (
          <Section title="Informação nutricional (estimada, por porção)">
            <View style={styles.nutriRow}>
              <Nutri label="Calorias" value={`${Math.round(recipe.nutrition_per_serving.calories)} kcal`} />
              <Nutri label="Proteínas" value={`${Math.round(recipe.nutrition_per_serving.protein_g)} g`} />
              <Nutri label="Carboidr." value={`${Math.round(recipe.nutrition_per_serving.carbs_g)} g`} />
              <Nutri label="Gorduras" value={`${Math.round(recipe.nutrition_per_serving.fat_g)} g`} />
            </View>
            <AppText variant="caption" color={Colors.textMuted}>
              Valores aproximados gerados por IA. Não substituem orientação de nutricionista.
            </AppText>
          </Section>
        ) : null}

        {recipe.substitutions.length ? (
          <Section title="Substituições">
            <Card style={{ gap: Spacing.md }}>
              {recipe.substitutions.map((s, i) => (
                <View key={i} style={{ gap: 2 }}>
                  <AppText variant="bodyStrong">
                    {s.ingredient} → {s.substitute}
                  </AppText>
                  {s.note ? (
                    <AppText variant="caption" color={Colors.textSecondary}>
                      {s.note}
                    </AppText>
                  ) : null}
                </View>
              ))}
            </Card>
          </Section>
        ) : null}

        {recipe.side_suggestions.length ? (
          <Section title="Acompanha bem">
            <View style={styles.badges}>
              {recipe.side_suggestions.map((s) => (
                <Badge key={s} label={s} tone="info" />
              ))}
            </View>
          </Section>
        ) : null}

        <Notice tone="warning" icon="shield-checkmark">
          {`${recipe.allergen_notes ? `${recipe.allergen_notes} ` : ''}Receita gerada por IA: confira rótulos e ingredientes se houver alergias. A IA não garante ausência de contaminação cruzada.`}
        </Notice>

        <Divider />
        <FeedbackForm recipeId={recipe.id} initial={initialFeedback} />
      </Screen>
    </>
  );
}

function Stat({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={Colors.primary} />
      <AppText variant="bodyStrong">{value}</AppText>
      <AppText variant="micro" color={Colors.textMuted}>
        {label.toUpperCase()}
      </AppText>
    </View>
  );
}

function Nutri({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.nutri}>
      <AppText variant="bodyStrong">{value}</AppText>
      <AppText variant="caption" color={Colors.textSecondary}>
        {label}
      </AppText>
    </View>
  );
}

/** Passo com marcação de concluído e temporizador simples (dentro do app). */
function StepCard({
  index,
  text,
  minutes,
  done,
  onToggle,
}: {
  index: number;
  text: string;
  minutes: number | null;
  done: boolean;
  onToggle: () => void;
}) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  function startTimer() {
    if (!minutes) return;
    if (timer.current) clearInterval(timer.current);
    setRemaining(minutes * 60);
    timer.current = setInterval(() => {
      setRemaining((r) => {
        if (r === null) return null;
        if (r <= 1) {
          if (timer.current) clearInterval(timer.current);
          if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
          return 0;
        }
        return r - 1;
      });
    }, 1000);
  }

  function stopTimer() {
    if (timer.current) clearInterval(timer.current);
    setRemaining(null);
  }

  const mm = remaining !== null ? String(Math.floor(remaining / 60)).padStart(2, '0') : '';
  const ss = remaining !== null ? String(remaining % 60).padStart(2, '0') : '';

  return (
    <Card style={[{ gap: Spacing.sm }, done && { opacity: 0.6 }]}>
      <Pressable onPress={onToggle} style={styles.stepRow} accessibilityRole="checkbox" accessibilityState={{ checked: done }}>
        <View style={[styles.stepNum, done && { backgroundColor: Colors.primary }]}>
          {done ? (
            <Ionicons name="checkmark" size={16} color={Colors.textOnPrimary} />
          ) : (
            <AppText variant="captionStrong" color={Colors.primaryDark}>
              {index + 1}
            </AppText>
          )}
        </View>
        <AppText style={[{ flex: 1 }, done && { textDecorationLine: 'line-through' }]}>{text}</AppText>
      </Pressable>
      {minutes ? (
        <View style={styles.timerRow}>
          {remaining === null ? (
            <Button title={`Timer ${formatMinutes(minutes)}`} icon="timer-outline" size="sm" variant="secondary" onPress={startTimer} />
          ) : remaining === 0 ? (
            <>
              <Badge tone="danger" icon="alarm" label="Tempo esgotado!" />
              <Button title="Fechar" size="sm" variant="ghost" onPress={stopTimer} />
            </>
          ) : (
            <>
              <AppText variant="heading" color={Colors.primaryDark} accessibilityLabel={`Faltam ${mm} minutos e ${ss} segundos`}>
                ⏱ {mm}:{ss}
              </AppText>
              <Button title="Parar" size="sm" variant="ghost" onPress={stopTimer} />
            </>
          )}
        </View>
      ) : null}
    </Card>
  );
}

function FeedbackForm({ recipeId, initial }: { recipeId: string; initial: Feedback | null }) {
  const [rating, setRating] = useState(initial?.rating ?? 0);
  const [worked, setWorked] = useState<boolean | null>(initial?.worked ?? null);
  const [comment, setComment] = useState(initial?.comment ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!rating) return setError('Escolha de 1 a 5 estrelas.');
    setError(null);
    setSaving(true);
    try {
      await saveFeedback(recipeId, { rating, worked, comment: comment.trim() || null });
      setSaved(true);
    } catch (err) {
      setError(toAppError(err).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title="Como ficou?">
      <View style={{ flexDirection: 'row', gap: Spacing.xs }} accessibilityRole="radiogroup" accessibilityLabel="Avaliação">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            accessibilityRole="radio"
            accessibilityState={{ checked: rating === n }}
            accessibilityLabel={`${n} ${n === 1 ? 'estrela' : 'estrelas'}`}
            onPress={() => {
              setRating(n);
              setSaved(false);
            }}
            hitSlop={4}>
            <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={32} color={n <= rating ? Colors.amber : Colors.textMuted} />
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', flexWrap: 'wrap' }}>
        <AppText variant="caption" color={Colors.textSecondary}>
          A receita funcionou?
        </AppText>
        <Button title="Sim" size="sm" variant={worked === true ? 'secondary' : 'outline'} onPress={() => { setWorked(true); setSaved(false); }} />
        <Button title="Não" size="sm" variant={worked === false ? 'danger' : 'outline'} onPress={() => { setWorked(false); setSaved(false); }} />
      </View>
      <TextField
        placeholder="Comentário (opcional): o que você mudaria?"
        value={comment}
        onChangeText={(t) => {
          setComment(t);
          setSaved(false);
        }}
        multiline
        maxLength={500}
      />
      {error ? <InlineError message={error} /> : null}
      <Button title={saved ? 'Avaliação salva' : 'Salvar avaliação'} icon={saved ? 'checkmark' : undefined} variant={saved ? 'secondary' : 'primary'} loading={saving} onPress={save} />
      <AppText variant="caption" color={Colors.textMuted}>
        Suas avaliações ajudam a IA a sugerir receitas mais do seu gosto.
      </AppText>
    </Section>
  );
}

const styles = StyleSheet.create({
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, justifyContent: 'center' },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    paddingVertical: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  ingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepRow: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingLeft: 40 },
  nutriRow: { flexDirection: 'row', gap: Spacing.sm },
  nutri: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Colors.border,
  },
});
