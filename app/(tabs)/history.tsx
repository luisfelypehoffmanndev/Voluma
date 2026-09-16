import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme/tokens';
import { CalendarPanel } from '@/ui/history/CalendarPanel';
import { StatsPanel } from '@/ui/history/StatsPanel';
import { Header, Screen } from '@/ui/Screen';
import { Segmented } from '@/ui/Segmented';

type HistoryView = 'calendar' | 'numbers';

const OPTIONS = [
  { value: 'calendar', label: 'Calendário' },
  { value: 'numbers', label: 'Números' },
] as const;

/**
 * Historico: o que ja aconteceu, em duas leituras do mesmo dado.
 *
 * Calendario e Numeros eram duas abas, e com Plano e Perfil entrando a barra
 * teria cinco icones abstratos. As duas respondem a mesma pergunta — "como
 * foram meus treinos" — entao dividem uma aba, com o seletor no topo.
 *
 * `?view=numbers` existe para quem chega de fora (o card de volume da home) cair
 * direto nos numeros. Voltar para a aba depois disso abre onde o usuario deixou.
 */
export default function HistoryScreen() {
  const params = useLocalSearchParams<{ view?: string }>();
  const [view, setView] = useState<HistoryView>(params.view === 'numbers' ? 'numbers' : 'calendar');

  useEffect(() => {
    if (params.view === 'numbers' || params.view === 'calendar') setView(params.view);
  }, [params.view]);

  return (
    <Screen>
      <Header title="Histórico" />
      <View style={styles.segmented}>
        <Segmented options={OPTIONS} value={view} onChange={setView} />
      </View>
      {view === 'calendar' ? <CalendarPanel /> : <StatsPanel />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segmented: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
});
