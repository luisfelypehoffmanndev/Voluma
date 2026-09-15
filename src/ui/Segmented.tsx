import { StyleSheet, View } from 'react-native';

import { colors, radius, spacing, surfaces } from '@/theme/tokens';

import { PressableSurface } from './PressableSurface';
import { Label } from './Text';

type Props<T extends string> = {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * Seletor segmentado: duas ou tres vistas do mesmo assunto.
 *
 * O segmento ativo e nivel 2 — uma superficie dentro do trilho —, a mesma
 * linguagem do chip selecionado do catalogo. Sem accent: a cor da tela fica com
 * o dado (a barra de hoje nos Numeros), nao com a navegacao.
 *
 * Todos os segmentos tem a mesma caixa, e o ativo muda so preenchimento e cor
 * do texto — trocar de vista nao pode fazer o trilho mudar de tamanho.
 */
export function Segmented<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.track} accessibilityRole="tablist">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableSurface
            key={option.value}
            feedback="none"
            onPress={() => onChange(option.value)}
            style={[styles.segment, selected && styles.selected]}
            accessibilityLabel={option.label}
          >
            <Label style={selected ? styles.labelSelected : undefined}>{option.label}</Label>
          </PressableSurface>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.pill,
    backgroundColor: surfaces.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'transparent',
    paddingHorizontal: spacing.md,
  },
  selected: {
    backgroundColor: surfaces.raised,
    borderColor: colors.borderStrong,
  },
  labelSelected: {
    color: colors.textPrimary,
  },
});
