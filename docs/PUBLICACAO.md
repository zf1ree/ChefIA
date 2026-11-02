# Publicação (Android e iOS)

Usamos **EAS** (Expo Application Services): builds na nuvem, sem precisar de Xcode/Android Studio locais.

## 1. Preparação

- Revise `app.json`: `name`, `slug`, `ios.bundleIdentifier` (`com.chefia.app`), `android.package` (`com.chefia.app`), `version`.
- Ícones: `node scripts/generate-icons.js` (ou substitua os arquivos em `assets/images`).
- Política de privacidade: revise com um advogado, preencha o controlador e o DPO e publique em uma URL pública (as lojas exigem um link).
- Supabase: plano Pro, SMTP próprio para e-mails de confirmação, `GROQ_API_KEY` de produção, limites revisados em `plan_limits`.

## 2. EAS

```bash
npx eas-cli@latest login
```

```bash
npx eas-cli@latest build:configure
```

Defina as variáveis públicas no EAS (o `.env.local` não vai para a nuvem):

```bash
npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_URL --value https://SEU-PROJETO.supabase.co --environment production --visibility plaintext
```

```bash
npx eas-cli@latest env:create --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value sb_publishable_xxx --environment production --visibility plaintext
```

Build de teste interno (APK instalável / TestFlight):

```bash
npx eas-cli@latest build --profile preview --platform android
```

Build de produção:

```bash
npx eas-cli@latest build --profile production --platform all
```

## 3. Envio às lojas

```bash
npx eas-cli@latest submit --platform android
```

```bash
npx eas-cli@latest submit --platform ios
```

- **Google Play:** conta de desenvolvedor (US$ 25, taxa única), formulário de *Data safety* (fotos processadas e não armazenadas; e-mail; dados de saúde opcionais = alergias), classificação etária.
- **App Store:** Apple Developer Program (US$ 99/ano), *App Privacy* (mesmas informações), justificativas de câmera e fotos (já em `app.json`), conta de teste para a revisão.

## 4. Atualizações

Mudanças só de JavaScript podem ir por OTA:

```bash
npx eas-cli@latest update --channel production --message "Correções"
```

Mudanças nativas (novas bibliotecas nativas, permissões, SDK) exigem novo build.

## Checklist de lançamento

- [ ] `npm run check` e `npm run lint` sem erros
- [ ] `supabase/tests/rls_test.sql` passando no projeto de produção
- [ ] Advisors do Supabase (Security/Performance) revisados
- [ ] Fluxo completo testado em Android e iPhone reais (foto → receitas → favoritos → lista)
- [ ] Mensagens de erro testadas: sem internet, cota esgotada, foto escura
- [ ] Política de privacidade revisada e publicada
- [ ] Limites do plano gratuito com teto mensal
