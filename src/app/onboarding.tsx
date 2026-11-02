import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/brand';
import { AppText, Button } from '@/components/ui';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { APP_NAME } from '@/lib/env';
import { useOnboarding } from '@/providers/onboarding-context';

const SLIDES = [
  {
    emoji: '📸',
    title: 'Fotografe sua geladeira',
    text: 'Tire uma foto da geladeira, do congelador, da despensa ou dos ingredientes na bancada.',
  },
  {
    emoji: '🧠',
    title: 'A IA reconhece os ingredientes',
    text: 'Você revisa a lista: corrige, adiciona ou remove itens antes de qualquer receita. Itens incertos aparecem marcados.',
  },
  {
    emoji: '🍳',
    title: 'Receitas com o que você tem',
    text: 'Sugestões priorizam o que já está em casa, mostram o que falta comprar e respeitam suas alergias e preferências.',
  },
];

export default function Onboarding() {
  const { complete } = useOnboarding();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(0);
  const slide = SLIDES[index];
  const last = index === SLIDES.length - 1;

  return (
    <View style={[styles.root, { paddingTop: insets.top + Spacing.lg, paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
      <View style={styles.inner}>
        <View style={styles.top}>
          <LogoMark size={40} />
          <AppText variant="heading">{APP_NAME}</AppText>
          <View style={{ flex: 1 }} />
          {!last ? <Button title="Pular" variant="ghost" size="sm" onPress={complete} /> : null}
        </View>

        <View style={styles.center}>
          <View style={styles.illustration}>
            <AppText style={{ fontSize: 88, lineHeight: 104 }}>{slide.emoji}</AppText>
          </View>
          <AppText variant="display" center>
            {slide.title}
          </AppText>
          <AppText variant="body" color={Colors.textSecondary} center style={{ maxWidth: 340 }}>
            {slide.text}
          </AppText>
        </View>

        <View style={{ gap: Spacing.lg }}>
          <View style={styles.dots} accessibilityLabel={`Passo ${index + 1} de ${SLIDES.length}`}>
            {SLIDES.map((s, i) => (
              <View key={s.title} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
          <Button
            title={last ? 'Começar' : 'Próximo'}
            size="lg"
            fullWidth
            icon={last ? 'arrow-forward' : undefined}
            onPress={() => (last ? complete() : setIndex(index + 1))}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', paddingHorizontal: Spacing.lg },
  inner: { flex: 1, width: '100%', maxWidth: MaxContentWidth, justifyContent: 'space-between' },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  center: { alignItems: 'center', gap: Spacing.lg },
  illustration: {
    width: 200,
    height: 200,
    borderRadius: Radius.xl * 2,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.border },
  dotActive: { width: 24, backgroundColor: Colors.primary },
});
