import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { APP_NAME, APP_TAGLINE } from '@/lib/env';

import { AppText } from './ui';

/** Marca do app: mesmo desenho do ícone (gerado por scripts/generate-icons.js). */
export function LogoMark({ size = 64 }: { size?: number }) {
  return (
    <Image
      source={require('@/assets/images/icon.png')}
      style={{ width: size, height: size, borderRadius: size * 0.26 }}
      accessibilityLabel={`Logo ${APP_NAME}`}
    />
  );
}

export function BrandSplash() {
  return (
    <View style={styles.splash} accessibilityLabel={`${APP_NAME} carregando`}>
      <LogoMark size={96} />
      <View style={{ alignItems: 'center', gap: Spacing.xs }}>
        <AppText variant="display" color={Colors.textOnPrimary}>
          {APP_NAME}
        </AppText>
        <AppText variant="body" color={Colors.primaryTint}>
          {APP_TAGLINE}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: Colors.primaryDark, alignItems: 'center', justifyContent: 'center', gap: Spacing.xl },
});
