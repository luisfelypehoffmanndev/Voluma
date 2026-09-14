import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteBodyWeightLog, listBodyWeightLogs, logBodyWeight } from '@/db/repo';
import { formatWeight } from '@/domain/volume';
import { bumpData, useQuery } from '@/store/data';
import { colors, fontSize, hitSlop, radius, spacing } from '@/theme/tokens';
import { relativeTime } from '@/ui/relative';
import { confirm } from '@/ui/haptics';
import { PressableSurface } from '@/ui/PressableSurface';
import { Header, Screen } from '@/ui/Screen';
import { StatNumber } from '@/ui/StatNumber';
import { Body, Label, Meta } from '@/ui/Text';
import { ArrowDownIcon, MinusIcon, PlusIcon, TrashIcon } from '@/ui/icons';

const STEP = 0.1;

/**
 * Log de peso corporal — a tela do mockup com o numero gigante.
 *
 * O valor inicial e o ultimo registro, nao zero: peso muda em decimos, e
 * comecar do ultimo torna o ajuste um ou dois toques.
 */
export default function BodyWeightScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data, reload } = useQuery(useCallback(() => listBodyWeightLogs(20), []));
  const logs = data ?? [];

  const [draft, setDraft] = useState<number | null>(null);
  const value = draft ?? logs[0]?.weightKg ?? 75;

  const nudge = (delta: number) =>
    setDraft(Math.max(0, Math.round((value + delta) * 10) / 10));

  const save = async () => {
    confirm();
    await logBodyWeight(value);
    bumpData();
    router.back();
  };

  return (
    <Screen>
      <Header
        title="Peso"
        action={{ icon: <ArrowDownIcon size={20} />, onPress: () => router.back() }}
      />

      <View style={styles.dial}>
        <Label>Quilos</Label>
        <View style={styles.dialRow}>
          <PressableSurface
            hitSlop={hitSlop}
            onPress={() => nudge(-STEP)}
            pressedOpacity={0.6}
            borderRadius={radius.pill}
            style={styles.nudge}
          >
            <MinusIcon size={18} color={colors.textSecondary} />
          </PressableSurface>

          <StatNumber value={formatWeight(value)} size={fontSize.numberXl} />

          <PressableSurface
            hitSlop={hitSlop}
            onPress={() => nudge(STEP)}
            pressedOpacity={0.6}
            borderRadius={radius.pill}
            style={styles.nudge}
          >
            <PlusIcon size={18} color={colors.textSecondary} />
          </PressableSurface>
        </View>

        <View style={styles.coarse}>
          {[-1, -0.5, 0.5, 1].map((delta) => (
            <PressableSurface
              key={delta}
              onPress={() => nudge(delta)}
              pressedOpacity={0.6}
              borderRadius={radius.pill}
              style={styles.chip}
            >
              <Label>
                {delta > 0 ? '+' : '−'}
                {formatWeight(Math.abs(delta))}
              </Label>
            </PressableSurface>
          ))}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.history, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <Label style={styles.historyTitle}>Registros recentes</Label>

        {logs.map((log) => (
          <View key={log.id} style={styles.logRow}>
            <View>
              <Body>{formatWeight(log.weightKg)} kg</Body>
              <Meta>{relativeTime(log.loggedAt)}</Meta>
            </View>
            <Pressable
              hitSlop={hitSlop}
              onPress={async () => {
                await deleteBodyWeightLog(log.id);
                bumpData();
                reload();
              }}
            >
              <TrashIcon size={16} color={colors.textSecondary} />
            </Pressable>
          </View>
        ))}

        {logs.length === 0 ? (
          <Meta style={styles.empty}>Nenhum registro ainda.</Meta>
        ) : null}
      </ScrollView>

      <PressableSurface
        onPress={save}
        pressedOpacity={0.6}
        borderRadius={radius.pill}
        style={[styles.save, { bottom: insets.bottom + spacing.xl }]}
      >
        <Body style={styles.saveLabel}>Registrar</Body>
      </PressableSurface>
    </Screen>
  );
}

const styles = StyleSheet.create({
  dial: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  dialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  nudge: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  coarse: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
  },
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  history: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
  },
  historyTitle: {
    marginBottom: spacing.md,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  empty: {
    paddingVertical: spacing.xxl,
  },
  save: {
    position: 'absolute',
    left: spacing.xl,
    right: spacing.xl,
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLabel: {
    color: colors.textOnAccent,
  },
});
