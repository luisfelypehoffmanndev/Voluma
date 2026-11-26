import { Redirect, Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import { useOnboarding } from '@/store/onboarding';
import { fonts, section, theme } from '@/theme/tokens';
import { ChartIcon, ListIcon, PersonIcon, TodayIcon, type IconProps } from '@/ui/icons';
import { tabTransitionSpec, useTabAnimation } from '@/ui/motion';
import { useTabBarGeometry } from '@/ui/tabBar';

/**
 * Barra de abas da linguagem Blink (Design/design.md §5): largura cheia,
 * opaca, colada no fundo, com divisor de 1px em cima. Icones Ionicons sem
 * rotulo: contorno quando inativos, preenchidos quando ativos.
 *
 * Sem botao central: comecar o treino e o botao principal da aba Hoje.
 * O nome de cada aba continua para o leitor de tela (`tabBarAccessibilityLabel`).
 */
export default function TabsLayout() {
  const bar = useTabBarGeometry();
  const onboarding = useOnboarding((state) => state.status);
  const tabAnimation = useTabAnimation();

  if (onboarding === 'needed') return <Redirect href="/onboarding" />;

  // A aba ativa acende em branco, preenchida; o vermelho fica nos detalhes.
  const tab = (label: string, Icon: (props: IconProps) => React.ReactElement, _color: string) => ({
    title: label,
    tabBarAccessibilityLabel: label,
    tabBarActiveTintColor: theme.onSurface,
    tabBarIcon: ({ focused }: { focused: boolean }) => (
      <Icon size={24} filled={focused} color={focused ? theme.onSurface : theme.outline} />
    ),
  });

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        // Com o nome embaixo de cada icone: so o icone nao dizia o que era cada
        // aba para quem abre o app pela primeira vez.
        tabBarShowLabel: true,
        tabBarActiveTintColor: theme.onSurface,
        tabBarInactiveTintColor: theme.outline,
        tabBarLabelStyle: { fontFamily: fonts.sansSemiBold, fontSize: 11 },
        animation: tabAnimation,
        transitionSpec: tabAnimation === 'fade' ? tabTransitionSpec : undefined,
        tabBarStyle: [styles.bar, { height: bar.height }],
        sceneStyle: { backgroundColor: theme.background },
      }}
    >
      <Tabs.Screen name="index" options={tab('Hoje', TodayIcon, section.today)} />
      <Tabs.Screen name="plan" options={tab('Plano', ListIcon, section.plan)} />
      <Tabs.Screen name="history" options={tab('Histórico', ChartIcon, section.history)} />
      <Tabs.Screen name="profile" options={tab('Perfil', PersonIcon, section.profile)} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.outlineVariant,
    elevation: 0,
  },
});
