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

export function SyncIcon(props: IconProps) {
  const { size, common } = base(props);
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M20 12a8 8 0 1 1-2.6-5.9" {...common} />
      <Polyline points="20,4 20,9 15,9" {...common} />
    </Svg>
  );
}
