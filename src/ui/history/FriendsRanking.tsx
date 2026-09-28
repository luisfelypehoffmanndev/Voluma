import { StyleSheet, View } from 'react-native';

import { rankByValue, rankingLabels } from '@/domain/friends';
import { colors, fontSize, fonts, spacing } from '@/theme/tokens';
import { Avatar } from '@/ui/Avatar';
import { Card } from '@/ui/Card';
import { ChevronRightIcon } from '@/ui/icons';
import { PressableSurface } from '@/ui/PressableSurface';
import { Body, Label, Meta, Mono } from '@/ui/Text';

import type { FriendPerson } from './useFriendsData';

type Props = {
  /** Voce e os amigos aceitos, em qualquer ordem. */
  people: readonly FriendPerson[];
  /** O seu toggle de compartilhamento. */
  selfShares: boolean;
  onOpen: (id: string) => void;
  /** Levar ao lugar onde se liga o compartilhamento. */
  onShare: () => void;
};

const AVATAR = 36;

/**
 * O ranking da semana: quem treinou mais dias, voce incluido.
 *
 * Uma linha por pessoa e nada mais — foto, primeiro nome, dias. O detalhe (12
 * semanas, meta, corrida) fica na tela de cada amigo, a um toque. Quem nao
 * compartilha nao entra no ranking (nao ha o que ranquear) e vira uma linha so
 * no fim: nunca "0 dias", que diria que a pessoa ficou parada.
 */
export function FriendsRanking({ people, selfShares, onOpen, onShare }: Props) {
  const labels = rankingLabels(people.filter((person) => !person.isSelf));
  const thisWeek = (person: FriendPerson) =>
    person.weeks === null ? null : person.weeks[person.weeks.length - 1];

  const ranked = rankByValue(
    people.filter((person) => person.weeks !== null),
    thisWeek,
  );
  const hidden = people.filter((person) => person.weeks === null);

  return (
    <Card>
      <Label>Esta semana</Label>

      {selfShares ? null : (
        <PressableSurface
          feedback="none"
          onPress={onShare}
          style={styles.nudge}
          accessibilityLabel="Seus amigos não veem seus números. Ligar o compartilhamento"
        >
          <Meta style={styles.nudgeText}>Seus amigos não veem seus números</Meta>
          <Meta style={styles.nudgeAction}>Ligar</Meta>
        </PressableSurface>
      )}

      {ranked.map((person, index) => {
        const label = person.isSelf ? { title: 'Você', subtitle: null } : labels.get(person.id);
        const days = thisWeek(person) ?? 0;
        const content = (
          <>
            <Mono style={[styles.position, person.isSelf && styles.strong]}>{index + 1}</Mono>
            <Avatar
              handle={person.handle}
              uri={person.avatarUri}
              path={person.avatarPath}
              color={person.color}
              size={AVATAR}
            />
            <View style={styles.name}>
              <Body numberOfLines={1} style={person.isSelf ? styles.selfName : null}>
                {label?.title}
              </Body>
              {label?.subtitle ? <Meta numberOfLines={1}>{label.subtitle}</Meta> : null}
            </View>
            <View style={styles.days}>
              <Mono style={[styles.daysNumber, person.isSelf && styles.strong]}>{days}</Mono>
              <Meta>{days === 1 ? 'dia' : 'dias'}</Meta>
            </View>
          </>
        );
        const a11y = `${index + 1}º, ${label?.title}, ${days} ${days === 1 ? 'dia' : 'dias'}`;

        return (
          <View key={person.id} style={index > 0 ? styles.divider : null}>
            {person.isSelf ? (
              <View style={styles.row} accessible accessibilityLabel={a11y}>
                {content}
                <View style={styles.chevron} />
              </View>
            ) : (
              <PressableSurface
                feedback="none"
                onPress={() => onOpen(person.id)}
                style={styles.row}
                accessibilityLabel={a11y}
              >
                {content}
                <ChevronRightIcon size={16} color={colors.textSecondary} />
              </PressableSurface>
            )}
          </View>
        );
      })}

      {hidden.length > 0 ? (
        <Meta style={styles.hidden}>{hiddenLine(hidden.map((person) => labels.get(person.id)?.title ?? `@${person.handle}`))}</Meta>
      ) : null}
    </Card>
  );
}

function hiddenLine(names: string[]): string {
  if (names.length === 1) return `${names[0]} não compartilha os números`;
  const list = `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
  return `${list} não compartilham os números`;
}

const styles = StyleSheet.create({
  nudge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
  },
  nudgeText: {
    flex: 1,
  },
  nudgeAction: {
    color: colors.textPrimary,
    fontFamily: fonts.sansMedium,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 64,
    paddingVertical: spacing.sm,
  },
  divider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
  },
  position: {
    width: 18,
    color: colors.textSecondary,
    fontSize: fontSize.bodyLg,
  },
  strong: {
    color: colors.textPrimary,
  },
  name: {
    flex: 1,
    gap: 2,
  },
  selfName: {
    fontFamily: fonts.sansMedium,
  },
  days: {
    alignItems: 'flex-end',
  },
  daysNumber: {
    fontSize: fontSize.numberSm,
    color: colors.textSecondary,
  },
  // A sua linha nao abre nada; o vao do chevron mantem os numeros alinhados.
  chevron: {
    width: 16,
  },
  hidden: {
    marginTop: spacing.md,
  },
});
