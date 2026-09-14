import * as Haptics from 'expo-haptics';

import { usePrefs } from '@/store/prefs';

/**
 * O toque tatil — ver Design/design.md §10.
 *
 * **So em confirmacao**, e confirmacao aqui tem definicao estreita: um gesto
 * que ESCREVE no banco. Marcar concluido, salvar um peso, criar um exercicio.
 * Navegar, rolar, trocar de aba, mexer no stepper e selecionar nao vibram — o
 * stepper sozinho dispararia dezenas de pulsos por exercicio, e e exatamente
 * isso que faz haptico parecer barato.
 *
 * **Um tipo so, `Rigid`.** E o unico da familia que le como interruptor
 * mecanico; `Light` e `Medium` sao batidas moles, a linguagem do "app de
 * bem-estar fofinho" que o §1 rejeita pelo nome. E nada de
 * `notificationAsync`: sucesso/aviso/erro sao a versao tatil da cor de estado
 * que o §7 proibe — nao existe buzz verde de "ok".
 */
export function confirm(): void {
  if (!usePrefs.getState().haptics) return;
  tap();
}

/**
 * O mesmo toque, ignorando a preferencia.
 *
 * Existe para um caso so: ligar a vibracao nos ajustes. Naquele instante a
 * preferencia ainda e `false` — ela so muda no proximo estado —, entao
 * `confirm()` seria no-op e o usuario ligaria a vibracao sem sentir o que
 * acabou de ligar. Aqui o toque E a demonstracao.
 *
 * Nao use em nenhum outro lugar: fora dos ajustes, ignorar a preferencia e
 * simplesmente desrespeita-la.
 */
export function preview(): void {
  tap();
}

// Nunca `await`: o retorno tatil nao pode segurar a escrita nem o render, e
// aparelho sem motor (ou emulador) rejeita a promessa. Em producao falhar em
// silencio continua sendo o comportamento certo — vibracao ausente nao e erro
// que valha um aviso na cara do usuario.
//
// Em desenvolvimento, nao. O `catch` vazio que havia aqui apagava a unica
// diferenca que importa quando o toque nao chega: se a chamada nativa RECUSOU
// (modulo ausente, plataforma sem suporte) ou se ela resolveu e foi o APARELHO
// que nao vibrou — no iOS, "Resposta Tatil do Sistema" desligada ou Modo de
// Baixo Consumo matam o Taptic Engine sem erro nenhum. Silencio no console
// aponta para o aparelho; um aviso aponta para o codigo.
function tap(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid).catch((error) => {
    if (__DEV__) console.warn('[Voluma] haptico recusado', error);
  });
}
