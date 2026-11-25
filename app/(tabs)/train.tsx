import { Redirect } from 'expo-router';

/**
 * O lugar do meio da barra de abas. Nao e uma tela: e o espacador onde o botao
 * "Treinar" pousa (ver `app/(tabs)/_layout.tsx`). O expo-router exige um
 * arquivo por `Tabs.Screen`; quem chegar aqui por link cai na Hoje.
 */
export default function TrainSlot() {
  return <Redirect href="/" />;
}
