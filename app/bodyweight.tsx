import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { deleteBodyWeightLog, listBodyWeightLogs, logBodyWeight } from '@/db/repo';
import { formatWeight } from '@/domain/volume';
import { bumpData, useQuery } from '@/store/data';
import { colors, fontSize, hitSlop, radius, spacing } from '@/theme/tokens';
import { relativeTime } from '@/ui/relative';
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
          <Pressable
            hitSlop={hitSlop}
            onPress={() => nudge(-STEP)}
            style={({ pressed }) => [styles.nudge, pressed && styles.pressed]}
          >
            <MinusIcon size={18} color={colors.textSecondary} />
          </Pressable>

          <StatNumber value={formatWeight(value)} size={fontSize.numberXl} />

          <Pressable
            hitSlop={hitSlop}
            onPress={() => nudge(STEP)}
            style={({ pressed }) => [styles.nudge, pressed && styles.pressed]}
          >
            <PlusIcon size={18} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={styles.coarse}>
          {[-1, -0.5, 0.5, 1].map((delta) => (
            <Pressable
              key={delta}
              onPress={() => nudge(delta)}
              style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
            >
              <Label>
                {delta > 0 ? '+' : '−'}
                {formatWeight(Math.abs(delta))}
              </Label>
            </Pressable>
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

      <Pressable
        onPress={save}
        style={({ pressed }) => [
          styles.save,
          { bottom: insets.bottom + spacing.xl },
          pressed && styles.pressed,
        ]}
      >
        <Body style={styles.saveLabel}>Registrar</Body>
      </Pressable>
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
  pressed: {
    opacity: 0.6,
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
