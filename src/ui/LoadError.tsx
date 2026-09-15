import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme/tokens';

import { Button } from './Button';
import { Body, Meta } from './Text';
import { AlertIcon } from './icons';

type Props = {
  error: Error;
  onRetry: () => void;
};

/**
 * "Nao foi possivel carregar" — com "Tentar de novo".
 *
 * Existe porque consulta que falhou e lista vazia davam a mesma tela. Sem
 * distinguir os dois, quem tem treinos gravados le "nenhum treino" e conclui
 * que o app perdeu os dados.
 *
 * Tudo em branco e cinza: icone outline, texto, botao de nivel 2. Erro nao
 * ganha vermelho (§7) — o que diz que e erro e a frase. O botao nao e vidro
 * porque esta tela substitui o CONTEUDO e rola com ele — ver a nota de posicao
 * em `Button.tsx`.
 *
 * A mensagem tecnica so aparece em desenvolvimento. "database is locked" ajuda
 * quem depura; quem esta na academia precisa saber que os dados estao salvos.
 */
export function LoadError({ error, onRetry }: Props) {
  return (
    <View style={styles.wrap}>
      <AlertIcon size={32} color={colors.textPrimary} />
      <Body style={styles.title}>Não foi possível carregar</Body>
      <Meta style={styles.text}>Seus treinos continuam salvos neste aparelho.</Meta>
      {__DEV__ ? <Meta style={styles.text}>{error.message}</Meta> : null}
      <Button variant="inline" label="Tentar de novo" onPress={onRetry} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxxl,
    gap: spacing.sm,
  },
  title: {
    marginTop: spacing.md,
    textAlign: 'center',
  },
  text: {
    textAlign: 'center',
  },
  button: {
    marginTop: spacing.xl,
    alignSelf: 'stretch',
  },
});
