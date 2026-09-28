import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
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
  const [view, setView] = useState<HistoryView>(
    isHistoryView(params.view) ? params.view : 'calendar',
  );

  useEffect(() => {
    if (isHistoryView(params.view)) setView(params.view);
  }, [params.view]);

  return (
    <Screen>
      <Header title="Histórico" />
      <View style={styles.segmented}>
        <Segmented options={OPTIONS} value={view} onChange={setView} />
      </View>
      {view === 'calendar' ? <CalendarPanel /> : null}
      {view === 'numbers' ? <StatsPanel /> : null}
      {view === 'friends' ? <FriendsPanel /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segmented: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
});
