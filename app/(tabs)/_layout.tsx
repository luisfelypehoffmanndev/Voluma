import { Redirect, Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import { useOnboarding } from '@/store/onboarding';
import { colors, radius } from '@/theme/tokens';
import { GlassSurface } from '@/ui/GlassSurface';
import { ChartIcon, ListIcon, PersonIcon, PlayIcon } from '@/ui/icons';
import { TabIcon } from '@/ui/TabIcon';
import { useTabBarGeometry } from '@/ui/tabBar';

/**
 * Tab bar flutuante — e o caso mais claro da regra do brief: ela paira sobre
 * conteudo rolavel, entao e vidro.
 *
 * Sem rotulos de texto: os quatro icones outline bastam, e texto embaixo de
 * icone e o visual generico que o brief manda evitar.
 *
 * Mas sem rotulo VISIVEL nao quer dizer sem nome: `tabBarAccessibilityLabel`
 * em todas, senao o leitor de tela anuncia "aba, 1 de 4" e nada mais. E cada
 * icone diz a ACAO da aba (comecar, montar, ver, voce), nao uma forma abstrata
 * — a grade e os sliders de antes nao diziam o que havia atras deles.
 */
export default function TabsLayout() {
  const bar = useTabBarGeometry();
  const onboarding = useOnboarding((state) => state.status);

  // Banco vazio: antes da home, o onboarding. O `_layout` raiz so solta o
  // splash depois de saber a resposta, entao esta troca nunca aparece na tela.
  if (onboarding === 'needed') return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        // As duas iguais: o estado agora vem da opacidade do `TabIcon`, nao
        // da cor. Deixar o inativo em `textSecondary` aplicaria os dois
        // efeitos um sobre o outro e o icone apagado sumiria.
        tabBarActiveTintColor: colors.textPrimary,
        tabBarInactiveTintColor: colors.textPrimary,
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
        // No Android o vidro so borra se estiver FORA da sub-arvore que ele le
        // (ver `src/ui/blurTarget.tsx`). Aqui isso sai de graca: o
        // `tabBarBackground` mora na barra, e a barra e irma das telas dentro
        // do navegador — nunca filha delas. Nao mova este vidro para dentro de
        // um `Screen`.
        tabBarBackground: () => (
          <GlassSurface borderRadius={radius.pill} style={StyleSheet.absoluteFill} />
        ),
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarAccessibilityLabel: 'Hoje',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <PlayIcon color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          tabBarAccessibilityLabel: 'Plano',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <ListIcon color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          tabBarAccessibilityLabel: 'Histórico',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <ChartIcon color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarAccessibilityLabel: 'Perfil',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon focused={focused}>
              <PersonIcon color={color} />
            </TabIcon>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    borderRadius: radius.pill,
    // A borda, o preenchimento e o brilho especular vem todos do GlassSurface
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
