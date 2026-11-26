import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

/**
 * O foguinho da sequencia: amarelo vivo no miolo, laranja e vermelho por fora.
 *
 * E a unica ilustracao colorida do app, de proposito: a sequencia e a
 * recompensa de voltar todo dia, e o fogo e o simbolo que todo mundo reconhece
 * para "nao deixe apagar".
 */
export function Flame({ size = 24 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id="flameOuter" x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0" stopColor="#E5332A" />
          <Stop offset="0.55" stopColor="#FF7A00" />
          <Stop offset="1" stopColor="#FFB000" />
        </LinearGradient>
        <LinearGradient id="flameInner" x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0" stopColor="#FF9F0A" />
          <Stop offset="1" stopColor="#FFE14D" />
        </LinearGradient>
      </Defs>
      <Path
        d="M12.4 1.6c.6 3.3-1.3 5.4-2.9 7.3-1.3 1.6-2.5 3.2-2.5 5.6A5 5 0 0 0 12 19.6a5 5 0 0 0 5-5.1c0-2.1-.9-3.7-2-5 .1 1.6-.5 2.8-1.6 3.4.4-3.3-.2-6.8-1-11.3Z"
        fill="url(#flameOuter)"
        transform="translate(0 2)"
      />
      <Path
        d="M12.2 11.2c.2 1.6-.8 2.5-1.5 3.4-.5.6-.9 1.2-.9 2.1a2.2 2.2 0 0 0 4.4.1c0-1-.4-1.7-.9-2.3 0 .7-.3 1.2-.8 1.5.2-1.5 0-3-.3-4.8Z"
        fill="url(#flameInner)"
        transform="translate(0 2)"
      />
    </Svg>
  );
}
