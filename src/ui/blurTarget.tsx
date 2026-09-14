import { BlurTargetView } from 'expo-blur';
import { useFocusEffect } from 'expo-router';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

/**
 * De quem o vidro amostra o que passa por baixo — no Android.
 *
 * O iOS resolve isso sozinho: `BlurView` la e material nativo, ele borra o que
 * estiver atras dele na tela e ponto. O Android nao tem esse conceito, entao o
 * expo-blur pede que se aponte, explicitamente, QUAL sub-arvore de views deve
 * ser borrada: um `BlurTargetView` marca o conteudo, e cada `BlurView` recebe
 * uma ref para ele.
 *
 * Duas coisas forcam a existencia deste arquivo, em vez de um `useRef` local:
 *
 * 1. **O vidro nao pode estar dentro do proprio alvo.** O README do BlurView
 *    e explicito — "The BlurTarget may not contain a BlurView that targets the
 *    same BlurTarget" —, e faz sentido: o alvo se desenha num RenderNode que o
 *    vidro le, entao um vidro la dentro se leria a si mesmo. Isso descarta um
 *    alvo unico na raiz envolvendo o app inteiro, porque a tab bar cairia
 *    dentro dele. O alvo tem que ser o conteudo da tela, e a tab bar fica na
 *    sub-arvore irma, dentro do navegador.
 *
 * 2. **As quatro telas de tab ficam montadas ao mesmo tempo.** Cada uma tem seu
 *    alvo, mas so uma esta visivel — e a tab bar precisa da que esta em foco.
 *    Por isso o alvo e reivindicado (`useFocusEffect`) em vez de passado por
 *    prop: quem ganha o foco vira o alvo corrente, e o vidro que vive fora das
 *    telas o encontra por aqui.
 */

type Target = RefObject<View | null> | null;

type Registry = {
  target: Target;
  claim: (target: Target) => void;
};

const noop = () => {};

const BlurTargetContext = createContext<Registry>({ target: null, claim: noop });

export function BlurTargetProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<Target>(null);
  const value = useMemo<Registry>(() => ({ target, claim: setTarget }), [target]);

  return <BlurTargetContext.Provider value={value}>{children}</BlurTargetContext.Provider>;
}

/**
 * O alvo da tela em foco, ou `null` onde nao houver um.
 *
 * `null` nao e erro: e a resposta certa antes da primeira tela montar, e dentro
 * de um `Modal` (ver `WithoutBlurTarget`). Quem consome cai no preenchimento
 * fosco nesses casos.
 */
export function useBlurTarget(): Target {
  return useContext(BlurTargetContext).target;
}

/** O conteudo que o vidro borra. Vira o alvo corrente enquanto a tela tem foco. */
export function BlurTarget({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const ref = useRef<View | null>(null);
  const { claim } = useContext(BlurTargetContext);

  useFocusEffect(
    useCallback(() => {
      claim(ref);
    }, [claim])
  );

  return (
    <BlurTargetView ref={ref} style={style}>
      {children}
    </BlurTargetView>
  );
}

/**
 * Anula o alvo para a sub-arvore.
 *
 * Um `Modal` do React Native e uma JANELA propria no Android, e o alvo da
 * janela principal nao alcanca la dentro. Sem isto o vidro do modal pediria
 * para borrar uma view de outra janela. Com o alvo nulo ele cai no
 * preenchimento fosco no Android; no iOS nada muda, porque o material nativo
 * de la nem le o alvo.
 */
export function WithoutBlurTarget({ children }: { children: ReactNode }) {
  const value = useMemo<Registry>(() => ({ target: null, claim: noop }), []);

  return <BlurTargetContext.Provider value={value}>{children}</BlurTargetContext.Provider>;
}
