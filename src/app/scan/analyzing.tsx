import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import type { AnalyzeImageResponse } from '@shared/schemas';

import { AppText, Button, Card, ErrorState, ProgressSteps, Screen } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { AppError, analyzeImage, toAppError } from '@/lib/api';
import { prepareImage, type PickedImage } from '@/lib/image';
import { flowStore, getPendingImage, reviewFromDetected, setPendingImage, useFlow } from '@/state/flow-store';

// Cada etapa corresponde a uma fase real do código abaixo.
const STEPS = ['Otimizando a foto no aparelho', 'Identificando seus ingredientes com IA', 'Preparando a lista para você revisar'];

const ISSUE_TITLES: Record<string, string> = {
  too_dark: 'A foto ficou escura',
  blurry: 'A foto ficou desfocada',
  no_food: 'Não encontrei alimentos',
  too_far: 'A foto está muito distante',
  obstructed: 'Os alimentos estão encobertos',
  other: 'Não consegui analisar bem esta foto',
  none: 'Não consegui analisar bem esta foto',
};

/** Etapas reais: preparo local da imagem → análise no servidor. */
async function analyze(picked: PickedImage, onStep: (step: number) => void): Promise<AnalyzeImageResponse> {
  onStep(0);
  const prepared = await prepareImage(picked);
  onStep(1);
  const result = await analyzeImage(prepared.base64, prepared.mimeType);
  onStep(2);
  return result;
}

export default function Analyzing() {
  const { photoUri } = useFlow();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<AppError | null>(null);
  const [unusable, setUnusable] = useState<AnalyzeImageResponse['image'] | null>(null);
  const alive = useRef(true);

  const run = useCallback(() => {
    const picked = getPendingImage();
    if (!picked) {
      router.replace('/scan/capture');
      return;
    }
    const onStep = (s: number) => {
      if (alive.current) setStep(s);
    };
    analyze(picked, onStep).then(
      (result) => {
        if (!alive.current) return;
        if (!result.image.usable) {
          setUnusable(result.image);
          return;
        }
        setPendingImage(null);
        flowStore.set({
          scanId: result.scan_id,
          scanNotes: result.notes,
          review: reviewFromDetected(result.ingredients),
          source: 'scan',
        });
        router.replace('/scan/review');
      },
      (err: unknown) => {
        if (!alive.current) return;
        const e = toAppError(err);
        if (e.code === 'consent_required') {
          router.replace('/scan/capture');
          return;
        }
        setError(e);
      },
    );
  }, []);

  function retry() {
    setError(null);
    setUnusable(null);
    setStep(0);
    run();
  }

  useEffect(() => {
    alive.current = true;
    run();
    return () => {
      alive.current = false;
    };
  }, [run]);

  const cancel = () => {
    alive.current = false;
    setPendingImage(null);
    router.back();
  };

  if (error) {
    return (
      <Screen scroll={false}>
        <ErrorState error={error} onRetry={retry} />
        <Button title="Escolher outra foto" variant="ghost" onPress={() => router.replace('/scan/capture')} />
        {error.code === 'quota_exceeded' || error.code === 'ai_not_configured' ? (
          <Button
            title="Digitar ingredientes manualmente"
            variant="secondary"
            onPress={() => {
              flowStore.set({ source: 'manual', review: [] });
              router.replace('/scan/review');
            }}
          />
        ) : null}
      </Screen>
    );
  }

  if (unusable) {
    return (
      <Screen>
        {photoUri ? <Image source={{ uri: photoUri }} style={styles.photoSmall} contentFit="cover" /> : null}
        <AppText variant="title">{ISSUE_TITLES[unusable.issue] ?? ISSUE_TITLES.other}</AppText>
        <AppText color={Colors.textSecondary}>{unusable.message}</AppText>
        <Button title="Tirar outra foto" icon="camera" size="lg" fullWidth onPress={() => router.replace('/scan/capture')} />
        <Button
          title="Adicionar ingredientes manualmente"
          variant="ghost"
          fullWidth
          onPress={() => {
            flowStore.set({ source: 'manual', review: [] });
            router.replace('/scan/review');
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScanningPhoto uri={photoUri} />
      <Card style={{ gap: Spacing.lg }}>
        <AppText variant="heading">Analisando sua foto</AppText>
        <ProgressSteps steps={STEPS} current={step} />
        <AppText variant="caption" color={Colors.textMuted}>
          Costuma levar de 5 a 20 segundos. A foto não é armazenada.
        </AppText>
      </Card>
      <Button title="Cancelar" variant="ghost" onPress={cancel} />
    </Screen>
  );
}

function ScanningPhoto({ uri }: { uri: string | null }) {
  const [height, setHeight] = useState(0);
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);
  return (
    <View style={styles.photoWrap} onLayout={(e) => setHeight(e.nativeEvent.layout.height)}>
      {uri ? <Image source={{ uri }} style={styles.photo} contentFit="cover" accessibilityLabel="Foto em análise" /> : null}
      <View style={styles.photoOverlay} />
      <Animated.View
        style={[styles.scanLine, { transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, Math.max(8, height - 11)] }) }] }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  photoWrap: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.lg, overflow: 'hidden', backgroundColor: Colors.surfaceMuted },
  photo: { width: '100%', height: '100%' },
  photoOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(15, 81, 54, 0.25)' },
  scanLine: { position: 'absolute', left: 0, right: 0, top: 0, height: 3, backgroundColor: Colors.primaryTint, opacity: 0.9 },
  photoSmall: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.lg, backgroundColor: Colors.surfaceMuted },
});
