import { createContext, useContext } from 'react';

export const OnboardingContext = createContext<{ complete: () => Promise<void> } | null>(null);

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding precisa estar dentro do RootNavigator');
  return ctx;
}
