import { useState } from 'react';
import { View } from 'react-native';

import { todayIso } from '@shared/expiry';

import { Spacing } from '@/constants/theme';
import { addDaysIso, formatDateBR, parseDateBR } from '@/lib/labels';

import { Chip, ChipGroup, TextField } from './ui';

const QUICK = [
  { label: 'Hoje', days: 0 },
  { label: 'Amanhã', days: 1 },
  { label: '3 dias', days: 3 },
  { label: '1 semana', days: 7 },
  { label: '1 mês', days: 30 },
];

/** Data de validade informada pelo usuário (opcional). */
export function ExpiryPicker({ value, onChange }: { value: string | null; onChange: (iso: string | null) => void }) {
  // Texto em edição; quando null, exibimos a data atual formatada.
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const text = draft ?? formatDateBR(value);
  const pick = (iso: string | null) => {
    setDraft(null);
    setError(null);
    onChange(iso);
  };

  const today = todayIso();
  return (
    <View style={{ gap: Spacing.sm }}>
      <TextField
        label="Validade (opcional)"
        placeholder="DD/MM/AAAA"
        keyboardType="numbers-and-punctuation"
        value={text}
        maxLength={10}
        error={error}
        hint="Use a data impressa na embalagem. O app não adivinha validade por foto."
        onChangeText={(t) => {
          setDraft(t);
          setError(null);
          if (!t.trim()) onChange(null);
          else if (t.length === 10) {
            const iso = parseDateBR(t);
            if (iso) {
              onChange(iso);
              setDraft(null);
            } else setError('Data inválida.');
          }
        }}
        onBlur={() => {
          if (text.trim() && !parseDateBR(text)) setError('Use o formato DD/MM/AAAA.');
        }}
      />
      <ChipGroup>
        {QUICK.map((q) => {
          const iso = addDaysIso(today, q.days);
          return <Chip key={q.label} label={q.label} selected={value === iso} onPress={() => pick(iso)} />;
        })}
        {value ? <Chip label="Sem validade" icon="close" onPress={() => pick(null)} /> : null}
      </ChipGroup>
    </View>
  );
}
