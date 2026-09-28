/**
 * Tipos para modulos internos do React Native que nao estao no `.d.ts` publico.
 *
 * Nao e para uso em codigo de app: e para os testes que precisam exercitar o
 * processamento de estilo de verdade. O caso concreto e o gradiente do campo de
 * luz e o da tab bar — um `background-image` malformado nao lanca erro, ele e
 * descartado em silencio e a superficie some. Testar isso exige chamar o mesmo
 * `processBackgroundImage` que o RN chama.
 */
declare module 'react-native/Libraries/StyleSheet/processBackgroundImage' {
  /** Devolve as camadas processadas, ou `[]` se qualquer uma for invalida. */
  const processBackgroundImage: (value: unknown) => readonly { type: string }[];
  export default processBackgroundImage;
}
