import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { totalMinutes } from '@shared/ranking';
import type { MealType, StoredRecipe } from '@shared/schemas';

import { Colors, Radius, Spacing } from '@/constants/theme';
import { DIFFICULTY_LABELS, MEAL_EMOJI, MEAL_LABELS, formatMinutes } from '@/lib/labels';
import type { RecipeSummary } from '@/services/recipes';

import { AppText, Badge, Card } from './ui';

const HERO_TINTS: Record<MealType, string> = {
  cafe_da_manha: '#FFF1DA',
  almoco: '#E6F4EC',
  jantar: '#EAE8FB',
  lanche: '#FDEBE6',
  sobremesa: '#FBE6F1',
};

export function RecipeHero({ mealType, size = 56 }: { mealType: string | null; size?: number }) {
  const m = (mealType ?? 'almoco') as MealType;
  return (
    <View
      style={[styles.hero, { width: size, height: size, backgroundColor: HERO_TINTS[m] ?? Colors.primarySoft }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <AppText style={{ fontSize: size * 0.5, lineHeight: size * 0.62 }}>{MEAL_EMOJI[m] ?? '🍽️'}</AppText>
    </View>
  );
}

export function RecipeCard({ recipe, onPress }: { recipe: StoredRecipe; onPress: () => void }) {
  const missingRequired = recipe.missing.filter((m) => !m.optional);
  return (
    <Card onPress={onPress} accessibilityLabel={`Receita ${recipe.title}`}>
      <View style={styles.row}>
        <RecipeHero mealType={recipe.meal_type} />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="heading" numberOfLines={2}>
            {recipe.title}
          </AppText>
          <AppText variant="caption" color={Colors.textSecondary} numberOfLines={2}>
            {recipe.description}
          </AppText>
        </View>
      </View>
      <View style={styles.meta}>
        <Meta icon="time-outline" label={formatMinutes(totalMinutes(recipe))} />
        <Meta icon="speedometer-outline" label={DIFFICULTY_LABELS[recipe.difficulty]} />
        <Meta icon="people-outline" label={`${recipe.servings} porç.`} />
      </View>
      <View style={styles.badges}>
        <Badge tone="success" icon="checkmark" label={`Você tem ${recipe.have.length}`} />
        {missingRequired.length ? (
          <Badge tone="warning" icon="cart-outline" label={`Faltam ${missingRequired.length}`} />
        ) : (
          <Badge tone="success" icon="sparkles" label="Nada a comprar" />
        )}
        {recipe.uses_expiring.length ? <Badge tone="danger" icon="hourglass-outline" label="Usa item que vence" /> : null}
      </View>
    </Card>
  );
}

export function RecipeSummaryRow({ recipe, subtitle, onPress }: { recipe: RecipeSummary; subtitle?: string; onPress: () => void }) {
  const meal = recipe.meal_type as MealType | null;
  return (
    <Card onPress={onPress} accessibilityLabel={`Receita ${recipe.title}`}>
      <View style={styles.row}>
        <RecipeHero mealType={recipe.meal_type} size={48} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="bodyStrong" numberOfLines={2}>
            {recipe.title}
          </AppText>
          <AppText variant="caption" color={Colors.textSecondary}>
            {[meal ? MEAL_LABELS[meal] : null, recipe.total_minutes ? formatMinutes(recipe.total_minutes) : null, subtitle]
              .filter(Boolean)
              .join(' · ')}
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
      </View>
    </Card>
  );
}

function Meta({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon} size={14} color={Colors.textSecondary} />
      <AppText variant="caption" color={Colors.textSecondary}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  hero: { borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', gap: Spacing.lg, marginTop: Spacing.md },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.md },
});
