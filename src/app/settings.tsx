import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Switch, View } from 'react-native';

import { AppText, Button, Card, InlineError, Notice, Screen, Section, TextField } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { toAppError } from '@/lib/api';
import { APP_NAME } from '@/lib/env';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/providers/auth-provider';
import { deleteMyAccount, setImageConsent, updateProfile } from '@/services/profile';

function confirm(title: string, message: string, action: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: action, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}

export default function Settings() {
  const { profile, session, setProfile, signOut } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  if (!profile || !session) return null;
  const userId = session.user.id;

  async function run(key: string, fn: () => Promise<void>) {
    setBusy(key);
    setError(null);
    setInfo(null);
    try {
      await fn();
    } catch (err) {
      setError(toAppError(err).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen>
      <Section title="Conta">
        <Card style={{ gap: Spacing.md }}>
          <TextField label="Nome" value={name} onChangeText={setName} maxLength={80} />
          <Button
            title="Salvar nome"
            variant="secondary"
            loading={busy === 'name'}
            disabled={name.trim() === (profile.display_name ?? '')}
            onPress={() =>
              run('name', async () => {
                setProfile(await updateProfile(userId, { display_name: name.trim() || null }));
                setInfo('Nome atualizado.');
              })
            }
          />
          <AppText variant="caption" color={Colors.textSecondary}>
            E-mail: {session.user.email}
          </AppText>
        </Card>
      </Section>

      <Section title="Privacidade">
        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.md }}>
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">Processamento de imagens por IA</AppText>
            <AppText variant="caption" color={Colors.textSecondary}>
              Necessário para analisar fotos. Desativar não apaga seus dados; você ainda pode digitar ingredientes.
            </AppText>
          </View>
          <Switch
            value={!!profile.image_processing_consent_at}
            disabled={busy === 'consent'}
            trackColor={{ true: Colors.primary, false: Colors.border }}
            accessibilityLabel="Consentimento para processamento de imagens"
            onValueChange={(v) => run('consent', async () => setProfile(await setImageConsent(userId, v)))}
          />
        </Card>
        <Button title="Ler a Política de Privacidade" variant="ghost" icon="document-text-outline" onPress={() => router.push('/privacy')} />
      </Section>

      <Section title="Seus dados">
        <Card style={{ gap: Spacing.md }}>
          <Button
            title="Apagar histórico de análises de fotos"
            variant="outline"
            loading={busy === 'scans'}
            onPress={async () => {
              if (!(await confirm('Apagar histórico', 'As listas de ingredientes das análises anteriores serão apagadas. Receitas e geladeira continuam.', 'Apagar'))) return;
              run('scans', async () => {
                const { error: err } = await supabase.from('scans').delete().eq('user_id', userId);
                if (err) throw err;
                setInfo('Histórico de análises apagado.');
              });
            }}
          />
          <Button
            title="Excluir minha conta"
            variant="danger"
            icon="trash-outline"
            loading={busy === 'delete'}
            onPress={async () => {
              if (
                !(await confirm(
                  'Excluir conta',
                  'Sua conta e todos os dados (geladeira, receitas, listas, histórico) serão apagados permanentemente. Essa ação não pode ser desfeita.',
                  'Excluir tudo',
                ))
              )
                return;
              run('delete', deleteMyAccount);
            }}
          />
        </Card>
      </Section>

      {error ? <InlineError message={error} /> : null}
      {info ? <Notice tone="success">{info}</Notice> : null}

      <Button title="Sair da conta" variant="outline" icon="log-out-outline" onPress={() => run('signout', signOut)} loading={busy === 'signout'} />

      <AppText variant="caption" color={Colors.textMuted} center>
        {APP_NAME} · versão {Constants.expoConfig?.version ?? '1.0.0'}
      </AppText>
    </Screen>
  );
}
