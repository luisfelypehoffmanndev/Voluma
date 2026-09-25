import { Pressable, StyleSheet } from 'react-native';

import { colors, radius, spacing, surfaces } from '@/theme/tokens';

import { Label } from './Text';

/**
 * Um filtro de toque unico: contorno fino apagado, e fundo elevado quando
 * selecionado. Sem accent: numa fileira de opcoes equivalentes, a cor diria que
 * uma delas importa mais que as outras.
 */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Label style={selected ? styles.labelSelected : undefined}>{label}</Label>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: surfaces.raised,
    borderColor: colors.borderStrong,
  },
  labelSelected: {
    color: colors.textPrimary,
  },
});
