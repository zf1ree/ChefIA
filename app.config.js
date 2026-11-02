// Estende o app.json. No APK de teste (perfil "preview") geramos só para
// arm64-v8a — praticamente todos os celulares Android atuais —, o que reduz
// o arquivo de ~107 MB para cerca de um terço. O build de produção (.aab)
// mantém todas as arquiteturas; a Play Store entrega só a necessária.
module.exports = ({ config }) => {
  const isPreview = process.env.EAS_BUILD_PROFILE === 'preview';
  const plugins = (config.plugins ?? []).map((p) =>
    p === 'expo-build-properties'
      ? ['expo-build-properties', { android: isPreview ? { buildArchs: ['arm64-v8a'] } : {} }]
      : p,
  );
  return { ...config, plugins };
};
