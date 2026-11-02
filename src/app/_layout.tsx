import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BrandSplash } from '@/components/brand';
import { AppText, Screen } from '@/components/ui';
import { Colors, Typography } from '@/constants/theme';
import { isBackendConfigured } from '@/lib/env';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { OnboardingContext } from '@/providers/onboarding-context';

SplashScreen.preventAutoHideAsync().catch(() => {});

const ONBOARDING_KEY = 'chefia.onboarding.v1';

function RootNavigator() {
  const { ready, session } = useAuth();
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  const [minSplashElapsed, setMinSplashElapsed] = useState(false);
  const [fontsLoaded, fontError] = useFonts(Ionicons.font);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((v) => setOnboardingDone(v === 'done'))
      .catch(() => setOnboardingDone(false));
    const t = setTimeout(() => setMinSplashElapsed(true), 900);
    return () => clearTimeout(t);
  }, []);

  const loaded = ready && onboardingDone !== null && (fontsLoaded || !!fontError);
  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  const complete = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDING_KEY, 'done').catch(() => {});
    setOnboardingDone(true);
  }, []);
  const ctx = useMemo(() => ({ complete }), [complete]);

  if (!loaded || !minSplashElapsed) return <BrandSplash />;

  const signedIn = !!session;
  return (
    <OnboardingContext.Provider value={ctx}>
      <Stack
        screenOptions={{
          headerTintColor: Colors.text,
          headerStyle: { backgroundColor: Colors.background },
          headerShadowVisible: false,
          headerTitleStyle: { fontSize: Typography.heading.fontSize, fontWeight: '700' },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: Colors.background },
        }}>
        <Stack.Protected guard={!onboardingDone && !signedIn}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="scan/capture" options={{ title: 'Fotografar ingredientes' }} />
          <Stack.Screen name="scan/analyzing" options={{ title: 'Analisando', headerBackVisible: false, gestureEnabled: false }} />
          <Stack.Screen name="scan/review" options={{ title: 'Revise os ingredientes' }} />
          <Stack.Screen name="recipes/generate" options={{ title: 'Gerar receitas' }} />
          <Stack.Screen name="recipes/results" options={{ title: 'Receitas para você' }} />
          <Stack.Screen name="recipes/[id]" options={{ title: '' }} />
          <Stack.Screen name="fridge/[id]" options={{ title: 'Ingrediente', presentation: 'modal' }} />
          <Stack.Screen name="what-now" options={{ title: 'O que posso fazer agora?' }} />
          <Stack.Screen name="preferences" options={{ title: 'Preferências alimentares' }} />
          <Stack.Screen name="settings" options={{ title: 'Configurações' }} />
        </Stack.Protected>
        <Stack.Screen name="privacy" options={{ title: 'Privacidade e dados' }} />
      </Stack>
    </OnboardingContext.Provider>
  );
}

function NotConfigured() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
  return (
    <Screen safeTop title="Configuração necessária">
      <AppText>
        As variáveis EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY não foram definidas. Copie o arquivo
        .env.example para .env.local, preencha os valores do seu projeto Supabase e reinicie o servidor (npx expo start -c).
      </AppText>
    </Screen>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {isBackendConfigured ? (
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      ) : (
        <NotConfigured />
      )}
    </SafeAreaProvider>
  );
}
