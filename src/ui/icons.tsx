import type { ColorValue } from 'react-native';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import { colors } from '@/theme/tokens';

/**
 * Icones outline, traco fino, monocromaticos. Sem preenchimento colorido, sem
 * badge, sem emoji — o brief e explicito sobre isso.
 *
 * Desenhados a mao em SVG em vez de puxar uma biblioteca de icones: sao poucos,
 * e assim o peso do traco fica consistente com a tipografia fina do app.
 */

export type IconProps = {
  size?: number;
  /** Aceita `ColorValue` para receber direto o `color` que a tab bar entrega. */
  color?: ColorValue;
  strokeWidth?: number;
};

function base({ size = 22, color = colors.textPrimary, strokeWidth = 1.4 }: IconProps) {
  return {
    size,
    stroke: color,
    strokeWidth,
    common: {
      stroke: color,
      strokeWidth,
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
      fill: 'none' as const,
    },
  };
}

export function GridIcon(props: IconProps) {
  const { size, common } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={4} y={4} width={6.5} height={6.5} rx={1.5} {...common} />
      <Rect x={13.5} y={4} width={6.5} height={6.5} rx={1.5} {...common} />
      <Rect x={4} y={13.5} width={6.5} height={6.5} rx={1.5} {...common} />
      <Rect x={13.5} y={13.5} width={6.5} height={6.5} rx={1.5} {...common} />
    </Svg>
  );
}

export function CalendarIcon(props: IconProps) {
  const { size, common } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={3.5} y={5} width={17} height={15} rx={3} {...common} />
      <Line x1={3.5} y1={9.5} x2={20.5} y2={9.5} {...common} />
      <Line x1={8} y1={3} x2={8} y2={6} {...common} />
      <Line x1={16} y1={3} x2={16} y2={6} {...common} />
    </Svg>
  );
}

export function ChartIcon(props: IconProps) {
  const { size, common } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1={5} y1={20} x2={5} y2={12} {...common} />
      <Line x1={12} y1={20} x2={12} y2={4} {...common} />
      <Line x1={19} y1={20} x2={19} y2={9} {...common} />
    </Svg>
  );
}

export function SlidersIcon(props: IconProps) {
  const { size, common } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1={4} y1={8} x2={20} y2={8} {...common} />
      <Line x1={4} y1={16} x2={20} y2={16} {...common} />
      <Circle cx={9} cy={8} r={2.4} {...common} />
      <Circle cx={15} cy={16} r={2.4} {...common} />
    </Svg>
  );
}

export function PlusIcon(props: IconProps) {
  const { size, common } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1={12} y1={5} x2={12} y2={19} {...common} />
      <Line x1={5} y1={12} x2={19} y2={12} {...common} />
    </Svg>
  );
}

export function MinusIcon(props: IconProps) {
  const { size, common } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1={5} y1={12} x2={19} y2={12} {...common} />
    </Svg>
  );
}

export function CheckIcon(props: IconProps) {
  const { size, common } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polyline points="5,12.5 10,17.5 19,7" {...common} />
    </Svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  const { size, common } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polyline points="9,5 16,12 9,19" {...common} />
    </Svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  const { size, common } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polyline points="15,5 8,12 15,19" {...common} />
    </Svg>
  );
}

export function ArrowDownIcon(props: IconProps) {
  const { size, common } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1={12} y1={4} x2={12} y2={19} {...common} />
      <Polyline points="6,13 12,19 18,13" {...common} />
    </Svg>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  const { size, common } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1={5} y1={12} x2={20} y2={12} {...common} />
      <Polyline points="11,6 5,12 11,18" {...common} />
    </Svg>
  );
}

export function TrashIcon(props: IconProps) {
  const { size, common } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Polyline points="4,6.5 20,6.5" {...common} />
      <Path d="M9 6.5V4.5h6v2" {...common} />
      <Path d="M6.5 6.5 7.5 20h9l1-13.5" {...common} />
    </Svg>
  );
}

/**
 * "Nao deu para carregar". Circulo com traco, branco — nunca o vermelho de
 * alerta, que e cor de estado (§7).
 */
export function AlertIcon(props: IconProps) {
  const { size, common } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={8.5} {...common} />
      <Line x1={12} y1={7.5} x2={12} y2={13} {...common} />
      <Line x1={12} y1={16.3} x2={12} y2={16.4} {...common} />
    </Svg>
  );
}

/** Mais opcoes. Tres pontos em traco, nao preenchidos: o resto da familia e outline. */
export function MoreIcon(props: IconProps) {
  const { size, common } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={5.5} cy={12} r={1.3} {...common} />
      <Circle cx={12} cy={12} r={1.3} {...common} />
      <Circle cx={18.5} cy={12} r={1.3} {...common} />
    </Svg>
  );
}

export function CloseIcon(props: IconProps) {
  const { size, common } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1={6} y1={6} x2={18} y2={18} {...common} />
      <Line x1={18} y1={6} x2={6} y2={18} {...common} />
    </Svg>
  );
}

/** Aba Hoje: a acao da aba e treinar, entao o icone e "comecar". */
export function PlayIcon(props: IconProps) {
  const { size, common } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M8 5.5v13a.6.6 0 0 0 .9.5l10-6.5a.6.6 0 0 0 0-1l-10-6.5a.6.6 0 0 0-.9.5Z" {...common} />
    </Svg>
  );
}

/** Aba Plano: a semana como lista de dias. */
export function ListIcon(props: IconProps) {
  const { size, common } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Line x1={9} y1={6.5} x2={20} y2={6.5} {...common} />
      <Line x1={9} y1={12} x2={20} y2={12} {...common} />
      <Line x1={9} y1={17.5} x2={20} y2={17.5} {...common} />
      <Circle cx={4.8} cy={6.5} r={0.9} {...common} />
      <Circle cx={4.8} cy={12} r={0.9} {...common} />
      <Circle cx={4.8} cy={17.5} r={0.9} {...common} />
    </Svg>
  );
}

export function PersonIcon(props: IconProps) {
  const { size, common } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={8.5} r={3.8} {...common} />
      <Path d="M4.5 20c.9-3.6 3.9-5.8 7.5-5.8s6.6 2.2 7.5 5.8" {...common} />
    </Svg>
  );
}

/**
 * O "G" do Google, em cor unica.
 *
 * Monocromatico e nao a marca colorida: o arquivo inteiro e outline sem
 * preenchimento colorido (§ do brief), e a variante mono e justamente a que o
 * guia de marca do Google permite sobre botao escuro. O desenho e preenchido
 * porque a marca e um glifo, nao um traco — e a unica excecao do arquivo.
 */
export function GoogleIcon({ size = 22, color = colors.textPrimary }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12s3.36-7.27 7.19-7.27c3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.19 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.16 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"
        fill={color}
      />
    </Svg>
  );
}

export function SyncIcon(props: IconProps) {
  const { size, common } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M20 12a8 8 0 1 1-2.6-5.9" {...common} />
      <Polyline points="20,4 20,9 15,9" {...common} />
    </Svg>
  );
}
