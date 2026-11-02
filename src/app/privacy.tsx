import { View } from 'react-native';

import { AppText, Card, Notice, Screen } from '@/components/ui';
import { Colors, Spacing } from '@/constants/theme';
import { APP_NAME } from '@/lib/env';

// Texto-base da política. Antes do lançamento, revise com um profissional
// jurídico e preencha os dados do controlador e do encarregado (DPO).
const SECTIONS: { title: string; body: string[] }[] = [
  {
    title: '1. Quem somos',
    body: [
      `${APP_NAME} é um aplicativo que sugere receitas a partir dos ingredientes que você tem em casa. Este texto explica, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018 — LGPD), quais dados tratamos e por quê.`,
    ],
  },
  {
    title: '2. Dados que coletamos',
    body: [
      'Conta: nome, e-mail e senha (a senha é armazenada de forma criptografada pelo provedor de autenticação).',
      'Preferências: alergias, restrições alimentares, ingredientes que você não gosta, itens básicos, tempo e porções. Alergias e restrições podem revelar informações de saúde (dado sensível) e são usadas exclusivamente para filtrar receitas, com o seu consentimento.',
      'Uso do app: ingredientes da sua geladeira, receitas geradas, favoritas, preparadas, avaliações e lista de compras.',
      'Fotos: somente quando você escolhe analisar uma imagem.',
    ],
  },
  {
    title: '3. Como tratamos as fotos',
    body: [
      'A foto é reduzida no seu aparelho e enviada por conexão criptografada ao nosso servidor, que a repassa ao provedor de inteligência artificial (atualmente Groq, Inc., com servidores fora do Brasil) apenas para identificar os alimentos.',
      'Não armazenamos a foto em nossos servidores. Guardamos apenas a lista de ingredientes identificados, para que você possa reutilizá-la.',
      'O processamento de imagens depende do seu consentimento, que pode ser revogado a qualquer momento em Configurações.',
      'Evite fotografar pessoas, documentos ou qualquer informação pessoal.',
    ],
  },
  {
    title: '4. Finalidades e bases legais',
    body: [
      'Prestar o serviço (execução de contrato): conta, geladeira, receitas, listas.',
      'Analisar fotos e considerar alergias/restrições (consentimento).',
      'Segurança e prevenção de abuso, como limites de uso (legítimo interesse).',
    ],
  },
  {
    title: '5. Compartilhamento',
    body: [
      'Supabase (banco de dados, autenticação e funções de servidor) e o provedor de IA atuam como operadores. Não vendemos seus dados nem os usamos para publicidade.',
    ],
  },
  {
    title: '6. Retenção e exclusão',
    body: [
      'Mantemos seus dados enquanto a conta existir. Você pode apagar o histórico de análises e excluir a conta (com todos os dados) em Configurações, a qualquer momento.',
    ],
  },
  {
    title: '7. Seus direitos',
    body: [
      'Você pode solicitar confirmação, acesso, correção, portabilidade, anonimização ou eliminação dos dados, além de informações sobre compartilhamento e revogação de consentimento (art. 18 da LGPD).',
    ],
  },
  {
    title: '8. Segurança alimentar',
    body: [
      'As receitas e informações nutricionais são geradas por IA e podem conter erros. O app filtra ingredientes ligados às suas alergias, mas não garante ausência de traços ou contaminação cruzada. Sempre leia os rótulos e, em caso de alergias graves, siga a orientação de profissionais de saúde.',
    ],
  },
];

export default function Privacy() {
  return (
    <Screen>
      <AppText variant="title">Política de Privacidade</AppText>
      <Notice tone="warning" icon="construct-outline">
        Versão preliminar para o MVP. Antes da publicação nas lojas, ela deve ser revisada juridicamente e completada com os
        dados do controlador e do canal de contato do encarregado (DPO).
      </Notice>
      {SECTIONS.map((s) => (
        <Card key={s.title} style={{ gap: Spacing.sm }}>
          <AppText variant="heading">{s.title}</AppText>
          <View style={{ gap: Spacing.sm }}>
            {s.body.map((p, i) => (
              <AppText key={i} color={Colors.textSecondary}>
                {p}
              </AppText>
            ))}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
