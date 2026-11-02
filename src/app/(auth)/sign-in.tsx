import { Link } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { LogoMark } from '@/components/brand';
import { AppText, Button, InlineError, Notice, Screen, TextField } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { APP_NAME, APP_TAGLINE } from '@/lib/env';
import { supabase } from '@/lib/supabase';

import { authErrorMessage, isValidEmail } from '@/lib/auth-helpers';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setInfo(null);
    if (!isValidEmail(email)) return setError('Informe um e-mail válido.');
    if (!password) return setError('Informe sua senha.');
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) setError(authErrorMessage(err.message));
  }

  async function forgot() {
    setError(null);
    setInfo(null);
    if (!isValidEmail(email)) return setError('Digite seu e-mail acima para receber o link de redefinição.');
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (err) setError(authErrorMessage(err.message));
    else setInfo('Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha.');
  }

  return (
    <Screen safeTop>
      <View style={{ alignItems: 'center', gap: Spacing.md, marginTop: Spacing.xxl, marginBottom: Spacing.lg }}>
        <LogoMark size={72} />
        <AppText variant="display">{APP_NAME}</AppText>
        <AppText color={Colors.textSecondary}>{APP_TAGLINE}</AppText>
      </View>

      <AppText variant="title">Entrar</AppText>
      <TextField
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="voce@email.com"
      />
      <TextField
        label="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        placeholder="Sua senha"
        onSubmitEditing={submit}
      />
      {error ? <InlineError message={error} /> : null}
      {info ? <Notice tone="success">{info}</Notice> : null}
      <Button title="Entrar" size="lg" fullWidth loading={loading} onPress={submit} />
      <Button title="Esqueci minha senha" variant="ghost" onPress={forgot} disabled={loading} />

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: Spacing.xs }}>
        <AppText color={Colors.textSecondary}>Ainda não tem conta?</AppText>
        <Link href="/sign-up" replace>
          <AppText variant="bodyStrong" color={Colors.primary}>
            Criar conta
          </AppText>
        </Link>
      </View>
    </Screen>
  );
}
