import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Button, InlineError, Notice, Screen, TextField } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

import { authErrorMessage, isValidEmail } from '@/lib/auth-helpers';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirmation, setPendingConfirmation] = useState(false);

  async function submit() {
    setError(null);
    if (!name.trim()) return setError('Informe como podemos te chamar.');
    if (!isValidEmail(email)) return setError('Informe um e-mail válido.');
    if (password.length < 8) return setError('A senha precisa ter pelo menos 8 caracteres.');
    if (!accepted) return setError('Para continuar, aceite a Política de Privacidade.');
    setLoading(true);
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { display_name: name.trim() } },
    });
    setLoading(false);
    if (err) return setError(authErrorMessage(err.message));
    // Com confirmação de e-mail ativa, não há sessão até o usuário confirmar.
    if (!data.session) setPendingConfirmation(true);
  }

  if (pendingConfirmation) {
    return (
      <Screen safeTop title="Confirme seu e-mail">
        <Notice tone="success" icon="mail-outline">
          {`Enviamos um link de confirmação para ${email.trim()}. Abra o e-mail, confirme e depois entre com sua senha.`}
        </Notice>
        <Link href="/sign-in" replace asChild>
          <Button title="Ir para o login" size="lg" fullWidth />
        </Link>
      </Screen>
    );
  }

  return (
    <Screen safeTop title="Criar conta" subtitle="Leva menos de um minuto.">
      <TextField label="Nome" value={name} onChangeText={setName} autoComplete="name" placeholder="Como podemos te chamar?" />
      <TextField
        label="E-mail"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="voce@email.com"
      />
      <TextField
        label="Senha"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        placeholder="Mínimo de 8 caracteres"
      />

      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
        onPress={() => setAccepted(!accepted)}
        style={{ flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' }}>
        <Ionicons name={accepted ? 'checkbox' : 'square-outline'} size={22} color={accepted ? Colors.primary : Colors.textMuted} />
        <AppText variant="caption" color={Colors.textSecondary} style={{ flex: 1 }}>
          Li e aceito a{' '}
          <Link href="/privacy">
            <AppText variant="captionStrong" color={Colors.primary}>
              Política de Privacidade
            </AppText>
          </Link>
          , incluindo como meus dados são tratados conforme a LGPD.
        </AppText>
      </Pressable>

      {error ? <InlineError message={error} /> : null}
      <Button title="Criar conta" size="lg" fullWidth loading={loading} onPress={submit} />

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: Spacing.xs }}>
        <AppText color={Colors.textSecondary}>Já tem conta?</AppText>
        <Link href="/sign-in" replace>
          <AppText variant="bodyStrong" color={Colors.primary}>
            Entrar
          </AppText>
        </Link>
      </View>
    </Screen>
  );
}
