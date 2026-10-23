import { render, screen } from '@testing-library/react-native';
import React from 'react';

import LoginScreen from '../login';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), replace: jest.fn() }),
  useIsFocused: () => true,
  useFocusEffect: jest.fn(),
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));

jest.mock('@/ui/Ambient', () => ({
  Ambient: () => null,
}));

jest.mock('@/sync/auth', () => ({
  useAuth: (select: (state: { signInWithGoogle: () => Promise<null> }) => unknown) =>
    select({ signInWithGoogle: async () => null }),
}));

jest.mock('@/store/profile', () => ({
  useProfile: { getState: () => ({ profile: null, load: jest.fn() }) },
}));

let mockStaffPanel = false;
const NOTICE = 'A equipe da academia vê seu plano e sua frequência';

jest.mock('@/store/flags', () => ({
  FLAG_STAFF_PANEL: 'staff_panel',
  STAFF_PANEL_NOTICE: 'A equipe da academia vê seu plano e sua frequência',
  useFlag: (key: string) => key === 'staff_panel' && mockStaffPanel,
}));

describe('LoginScreen — aviso do painel da academia', () => {
  it('avisa que a equipe ve plano e frequencia quando a academia usa o painel', async () => {
    mockStaffPanel = true;
    await render(<LoginScreen />);
    expect(screen.getByText(NOTICE)).toBeTruthy();
  });

  it('nao fala de equipe nenhuma sem a flag (app padrao, academia sem painel)', async () => {
    mockStaffPanel = false;
    await render(<LoginScreen />);
    expect(screen.queryByText(NOTICE)).toBeNull();
    expect(screen.getByText('Continuar com Google')).toBeTruthy();
  });
});
