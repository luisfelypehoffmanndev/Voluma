import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme/tokens';
import { CalendarPanel } from '@/ui/history/CalendarPanel';
import { FriendsPanel } from '@/ui/history/FriendsPanel';
import { StatsPanel } from '@/ui/history/StatsPanel';
import { Header, Screen } from '@/ui/Screen';
import { Segmented } from '@/ui/Segmented';

type HistoryView = 'calendar' | 'numbers' | 'friends';

const OPTIONS = [
  { value: 'calendar', label: 'Calendário' },
  { value: 'numbers', label: 'Números' },
  { value: 'friends', label: 'Amigos' },
] as const;

function isHistoryView(value: string | undefined): value is HistoryView {
  return OPTIONS.some((option) => option.value === value);
}

/**
 * Historico: o que ja aconteceu, em tres leituras.
 *
 * Calendario e Numeros eram duas abas, e com Plano e Perfil entrando a barra
 * teria cinco icones abstratos. As duas respondem a mesma pergunta — "como
 * foram meus treinos" — entao dividem uma aba, com o seletor no topo. Amigos
 * entra como terceira leitura: a mesma semana, ao lado da dos outros.
 *
 * O segmento Amigos aparece mesmo sem conta: o trilho nao muda de tamanho
 * conforme o login, e o vazio se explica dentro do painel.
 *
 * `?view=numbers` existe para quem chega de fora (o card de volume da home) cair
 * direto nos numeros. Voltar para a aba depois disso abre onde o usuario deixou.
 */
export default function HistoryScreen() {
  const params = useLocalSearchParams<{ view?: string }>();
  const initialView = isHistoryView(params.view) ? params.view : 'calendar';
  const [view, setView] = useState<HistoryView>(initialView);
  const [visited, setVisited] = useState<Record<HistoryView, boolean>>(() => ({
    calendar: initialView === 'calendar',
    numbers: initialView === 'numbers',
    friends: initialView === 'friends',
  }));

  const [prevParamView, setPrevParamView] = useState(params.view);
  if (params.view !== prevParamView) {
    setPrevParamView(params.view);
    if (isHistoryView(params.view)) {
      const nextView = params.view;
      setView(nextView);
      if (!visited[nextView]) {
        setVisited((prev) => ({ ...prev, [nextView]: true }));
      }
    }
  }

  const onChangeView = (next: HistoryView) => {
    setView(next);
    if (!visited[next]) {
      setVisited((prev) => ({ ...prev, [next]: true }));
    }
  };

  return (
    <Screen>
      <Header title="Histórico" />
      <View style={styles.segmented}>
        <Segmented options={OPTIONS} value={view} onChange={onChangeView} />
      </View>
      <View style={[styles.panel, view !== 'calendar' && styles.hidden]}>
        {visited.calendar ? <CalendarPanel /> : null}
      </View>
      <View style={[styles.panel, view !== 'numbers' && styles.hidden]}>
        {visited.numbers ? <StatsPanel /> : null}
      </View>
      <View style={[styles.panel, view !== 'friends' && styles.hidden]}>
        {visited.friends ? <FriendsPanel /> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  segmented: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  panel: {
    flex: 1,
  },
  hidden: {
    display: 'none',
  },
});
