import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { normalizeName } from '@shared/normalize';
import { ALLERGY_OPTIONS, RESTRICTION_OPTIONS } from '@shared/safety';

import { AppText, Button, Chip, ChipGroup, InlineError, Notice, Screen, Section, Stepper, TextField } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { toAppError } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { CUISINE_OPTIONS, STAPLE_SUGGESTIONS, updateProfile } from '@/services/profile';

const TIME_OPTIONS: { label: string; value: number | null }[] = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 hora', value: 60 },
  { label: '2 horas', value: 120 },
  { label: 'Sem limite', value: null },
];

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Lista de valores livres (ex.: alergia não listada, ingredientes que não gosta). */
function FreeList({
  values,
  onChange,
  placeholder,
  tone,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  tone?: 'danger';
}) {
  const [text, setText] = useState('');
  const add = () => {
    const clean = text.trim();
    if (!clean || values.some((v) => normalizeName(v) === normalizeName(clean))) return setText('');
    onChange([...values, clean]);
    setText('');
  };
  return (
    <View style={{ gap: Spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <TextField placeholder={placeholder} value={text} onChangeText={setText} onSubmitEditing={add} maxLength={40} returnKeyType="done" />
        </View>
        <Button title="Adicionar" variant="outline" onPress={add} disabled={!text.trim()} />
      </View>
      {values.length ? (
        <ChipGroup>
          {values.map((v) => (
            <Chip key={v} label={v} selected tone={tone} onRemove={() => onChange(values.filter((x) => x !== v))} />
          ))}
        </ChipGroup>
      ) : null}
    </View>
  );
}

export default function Preferences() {
  const { profile, session, setProfile } = useAuth();
  const knownAllergy = new Set<string>(ALLERGY_OPTIONS.map((o) => o.key));
  const knownRestriction = new Set<string>(RESTRICTION_OPTIONS.map((o) => o.key));

  const [allergies, setAllergies] = useState<string[]>(profile?.allergies ?? []);
  const [restrictions, setRestrictions] = useState<string[]>(profile?.dietary_restrictions ?? []);
  const [disliked, setDisliked] = useState<string[]>(profile?.disliked_ingredients ?? []);
  const [cuisines, setCuisines] = useState<string[]>(profile?.cuisine_preferences ?? []);
  const [staples, setStaples] = useState<string[]>(profile?.pantry_staples ?? []);
  const [maxMinutes, setMaxMinutes] = useState<number | null>(profile?.max_cooking_minutes ?? null);
  const [servings, setServings] = useState(profile?.default_servings ?? 2);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile || !session) return null;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateProfile(session!.user.id, {
        allergies,
        dietary_restrictions: restrictions,
        disliked_ingredients: disliked,
        cuisine_preferences: cuisines,
        pantry_staples: staples,
        max_cooking_minutes: maxMinutes,
        default_servings: servings,
      });
      setProfile(updated);
      router.back();
    } catch (err) {
      setError(toAppError(err).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen footer={<Button title="Salvar preferências" size="lg" fullWidth loading={saving} onPress={save} />}>
      <Notice tone="warning" icon="medkit-outline">
        Alergias e restrições são usadas como filtro de segurança nas receitas, mas a IA pode errar e não garante ausência de
        contaminação cruzada. Sempre confira rótulos e, em caso de alergia grave, siga a orientação do seu médico.
      </Notice>

      <Section title="Alergias">
        <ChipGroup>
          {ALLERGY_OPTIONS.map((o) => (
            <Chip key={o.key} label={o.label} tone="danger" selected={allergies.includes(o.key)} onPress={() => setAllergies(toggle(allergies, o.key))} />
          ))}
        </ChipGroup>
        <FreeList
          values={allergies.filter((a) => !knownAllergy.has(a))}
          onChange={(custom) => setAllergies([...allergies.filter((a) => knownAllergy.has(a)), ...custom])}
          placeholder="Outra alergia (ex.: kiwi)"
          tone="danger"
        />
      </Section>

      <Section title="Restrições alimentares">
        <ChipGroup>
          {RESTRICTION_OPTIONS.map((o) => (
            <Chip key={o.key} label={o.label} selected={restrictions.includes(o.key)} onPress={() => setRestrictions(toggle(restrictions, o.key))} />
          ))}
        </ChipGroup>
        {restrictions.filter((r) => !knownRestriction.has(r)).length ? (
          <ChipGroup>
            {restrictions
              .filter((r) => !knownRestriction.has(r))
              .map((r) => (
                <Chip key={r} label={r} selected onRemove={() => setRestrictions(restrictions.filter((x) => x !== r))} />
              ))}
          </ChipGroup>
        ) : null}
      </Section>

      <Section title="Ingredientes que você não gosta">
        <FreeList values={disliked} onChange={setDisliked} placeholder="Ex.: coentro, fígado" />
      </Section>

      <Section title="Preferências culinárias">
        <ChipGroup>
          {CUISINE_OPTIONS.map((c) => (
            <Chip key={c} label={c} selected={cuisines.includes(c)} onPress={() => setCuisines(toggle(cuisines, c))} />
          ))}
        </ChipGroup>
      </Section>

      <Section title="Itens básicos que você sempre tem">
        <AppText variant="caption" color={Colors.textSecondary}>
          O app só considera que você tem sal, óleo, temperos etc. se estiverem marcados aqui.
        </AppText>
        <ChipGroup>
          {STAPLE_SUGGESTIONS.map((s) => (
            <Chip
              key={s}
              label={s}
              icon={staples.includes(s) ? 'checkmark' : undefined}
              selected={staples.includes(s)}
              onPress={() => setStaples(toggle(staples, s))}
            />
          ))}
        </ChipGroup>
        <FreeList
          values={staples.filter((s) => !STAPLE_SUGGESTIONS.includes(s))}
          onChange={(custom) => setStaples([...staples.filter((s) => STAPLE_SUGGESTIONS.includes(s)), ...custom])}
          placeholder="Outro básico (ex.: shoyu)"
        />
      </Section>

      <Section title="Tempo máximo para cozinhar">
        <ChipGroup>
          {TIME_OPTIONS.map((t) => (
            <Chip key={t.label} label={t.label} selected={maxMinutes === t.value} onPress={() => setMaxMinutes(t.value)} />
          ))}
        </ChipGroup>
      </Section>

      <Section title="Pessoas que vão comer" action={<Stepper label="pessoas" value={servings} onChange={setServings} />}>
        <View />
      </Section>

      {error ? <InlineError message={error} /> : null}
    </Screen>
  );
}
