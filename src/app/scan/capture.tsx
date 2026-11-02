import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText, Button, Card, InlineError, Notice, Screen } from '@/components/ui';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { toAppError } from '@/lib/api';
import { pickImage, type PickedImage, type PickSource } from '@/lib/image';
import { useAuth } from '@/providers/auth-provider';
import { setImageConsent } from '@/services/profile';
import { flowStore, setPendingImage } from '@/state/flow-store';

export default function Capture() {
  const { profile, setProfile, session } = useAuth();
  const [image, setImage] = useState<PickedImage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<PickSource | 'consent' | null>(null);

  if (!profile) {
    return <Screen><AppText color={Colors.textSecondary}>Carregando seu perfil…</AppText></Screen>;
  }

  if (!profile.image_processing_consent_at) {
    return (
      <Screen
        footer={
          <Button
            title="Concordo e quero continuar"
            size="lg"
            fullWidth
            loading={busy === 'consent'}
            onPress={async () => {
              setBusy('consent');
              setError(null);
              try {
                setProfile(await setImageConsent(session!.user.id, true));
              } catch (err) {
                setError(toAppError(err).message);
              } finally {
                setBusy(null);
              }
            }}
          />
        }>
        <View style={styles.consentIcon}>
          <Ionicons name="shield-checkmark" size={40} color={Colors.primary} />
        </View>
        <AppText variant="title">Antes da primeira foto</AppText>
        <AppText color={Colors.textSecondary}>
          Para identificar seus ingredientes, a foto é enviada de forma segura ao nosso servidor e analisada por um serviço de
          inteligência artificial (Groq). Veja como tratamos a imagem:
        </AppText>
        <Card style={{ gap: Spacing.md }}>
          <ConsentItem icon="trash-outline" text="A foto não é armazenada: é usada só durante a análise e descartada em seguida." />
          <ConsentItem icon="list-outline" text="Guardamos apenas a lista de ingredientes identificados, no seu histórico." />
          <ConsentItem icon="resize-outline" text="A imagem é reduzida no seu aparelho antes do envio." />
          <ConsentItem icon="person-outline" text="Evite fotografar pessoas, documentos ou informações pessoais." />
        </Card>
        <AppText variant="caption" color={Colors.textSecondary}>
          Você pode revogar esse consentimento a qualquer momento em Configurações.{' '}
          <Link href="/privacy">
            <AppText variant="captionStrong" color={Colors.primary}>
              Ler a Política de Privacidade
            </AppText>
          </Link>
        </AppText>
        {error ? <InlineError message={error} /> : null}
      </Screen>
    );
  }

  async function choose(source: PickSource) {
    setError(null);
    setBusy(source);
    try {
      const picked = await pickImage(source);
      if (picked) setImage(picked);
    } catch (err) {
      setError(toAppError(err).message);
    } finally {
      setBusy(null);
    }
  }

  if (image) {
    return (
      <Screen
        footer={
          <View style={{ width: '100%', gap: Spacing.sm }}>
            <Button
              title="Analisar esta foto"
              icon="sparkles"
              size="lg"
              fullWidth
              onPress={() => {
                setPendingImage(image);
                flowStore.set({ photoUri: image.uri, source: 'scan' });
                router.replace('/scan/analyzing');
              }}
            />
            <Button title="Escolher outra" variant="ghost" fullWidth onPress={() => setImage(null)} />
          </View>
        }>
        <AppText variant="heading">Confira a foto</AppText>
        <Image source={{ uri: image.uri }} style={styles.preview} contentFit="cover" accessibilityLabel="Prévia da foto" />
        <Notice>A foto está nítida e iluminada? Fotos escuras ou tremidas reduzem a precisão.</Notice>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: Spacing.xs }}>
        <AppText variant="title">Mostre seus ingredientes</AppText>
        <AppText color={Colors.textSecondary}>Geladeira aberta, congelador, despensa ou itens na bancada.</AppText>
      </View>

      <Card onPress={() => choose('camera')} style={styles.option} accessibilityLabel="Tirar foto com a câmera">
        <View style={[styles.optionIcon, { backgroundColor: Colors.primary }]}>
          <Ionicons name="camera" size={28} color={Colors.textOnPrimary} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="heading">Tirar foto</AppText>
          <AppText variant="caption" color={Colors.textSecondary}>
            Use a câmera do celular
          </AppText>
        </View>
        {busy === 'camera' ? null : <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />}
      </Card>

      <Card onPress={() => choose('library')} style={styles.option} accessibilityLabel="Escolher foto da galeria">
        <View style={[styles.optionIcon, { backgroundColor: Colors.primarySoft }]}>
          <Ionicons name="images" size={26} color={Colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="heading">Escolher da galeria</AppText>
          <AppText variant="caption" color={Colors.textSecondary}>
            Use uma foto que você já tirou
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
      </Card>

      {error ? <InlineError message={error} /> : null}

      <View style={{ gap: Spacing.sm }}>
        <AppText variant="captionStrong" color={Colors.textSecondary}>
          DICAS
        </AppText>
        <Tip text="Boa iluminação e foto de frente." />
        <Tip text="Afaste-se o suficiente para mostrar as prateleiras." />
        <Tip text="Itens em potes fechados podem não aparecer — você poderá adicioná-los na revisão." />
      </View>
    </Screen>
  );
}

function ConsentItem({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' }}>
      <Ionicons name={icon} size={20} color={Colors.primary} />
      <AppText variant="body" style={{ flex: 1 }}>
        {text}
      </AppText>
    </View>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
      <Ionicons name="checkmark-circle-outline" size={18} color={Colors.primary} />
      <AppText variant="caption" color={Colors.textSecondary} style={{ flex: 1 }}>
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  optionIcon: { width: 56, height: 56, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  preview: { width: '100%', aspectRatio: 3 / 4, borderRadius: Radius.lg, backgroundColor: Colors.surfaceMuted },
  consentIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
