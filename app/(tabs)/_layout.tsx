import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import { colors, radius } from '@/theme/tokens';
import { CalendarIcon, ChartIcon, GridIcon, SlidersIcon } from '@/ui/icons';
import { useTabBarGeometry } from '@/ui/tabBar';
import { TabBarSurface } from '@/ui/TabBarSurface';

/**
 * Tab bar flutuante — e o caso mais claro da regra do brief: ela paira sobre
 * conteudo rolavel, entao e vidro.
 *
 * O fundo vem do `TabBarSurface`, e nao do `GlassSurface`: sem blur no Android
 * o vidro de nivel 3 virava uma laje opaca que nao amostrava o campo de luz —
 * a unica superficie do app que nao amostrava. Ver o cabecalho daquele arquivo
 * para a saida.
 *
 * Sem rotulos de texto: os quatro icones outline bastam, e texto embaixo de
 * icone e o visual generico que o brief manda evitar.
 */
export default function TabsLayout() {
  const bar = useTabBarGeometry();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: [
          styles.bar,
          {
            height: bar.height,
            bottom: bar.bottom,
            // `start`/`end`, nao `left`/`right`. O BottomTabBar ja aplica
            // `start: 0, end: 0` no proprio container, e no Yoga as propriedades
            // logicas ganham das fisicas — um `left` aqui e simplesmente
            // ignorado, e o pill esticava de ponta a ponta da tela.
            start: bar.sideInset,
            end: bar.sideInset,
          },
        ],
        tabBarItemStyle: { height: bar.height },
        // Centraliza o icone na vertical. O item interno do BottomTabItem usa
        // `justifyContent: 'flex-start'` num container de coluna que ocupa a
        // altura toda do pill — pensado para deixar espaco ao label embaixo.
        // Com `tabBarShowLabel: false` o label some mas o alinhamento fica, e o
        // icone gruda no topo. Esse estilo interno nao e alcancavel por
        // `tabBarItemStyle` (que vai para a View externa); `tabBarIconStyle` e o
        // unico prop mesclado no wrapper do icone. Com `flex: 1` o wrapper
        // deixa de ter altura fixa de 28px e passa a ocupar a caixa inteira,
        // onde o icone ja se centraliza sozinho.
        tabBarIconStyle: { flex: 1 },
        tabBarBackground: () => <TabBarSurface />,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ tabBarIcon: ({ color }) => <GridIcon color={color} /> }}
      />
      <Tabs.Screen
        name="calendar"
        options={{ tabBarIcon: ({ color }) => <CalendarIcon color={color} /> }}
      />
      <Tabs.Screen
        name="stats"
        options={{ tabBarIcon: ({ color }) => <ChartIcon color={color} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ tabBarIcon: ({ color }) => <SlidersIcon color={color} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    borderRadius: radius.pill,
    // A borda, o preenchimento e o brilho especular vem todos do TabBarSurface
    // renderizado em tabBarBackground; aqui a barra e so transparente.
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    elevation: 0,
    // Zerar os paddings de area segura NAO e cosmetico. O BottomTabBar aplica
    // `paddingBottom: insets.bottom` no proprio container e, como `tabBarStyle`
    // e mesclado por ultimo, so as chaves que declaramos vencem — o padding
    // sobrevive. Numa barra de altura livre isso e o certo; nesta, que tem
    // altura fixa e ja flutua acima da area segura, o inset comia ate 48px dos
    // 60 do pill e espremia os icones para fora dele. O respiro pela area
    // segura e dado pelo `bottom` de `useTabBarGeometry`, nao por padding.
    paddingBottom: 0,
    paddingTop: 0,
    paddingHorizontal: 0,
  },
});
