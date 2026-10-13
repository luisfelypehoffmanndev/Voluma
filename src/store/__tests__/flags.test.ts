import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook } from '@testing-library/react-native';

import { getFlag, storageKeyFor, useFlag, useFlags } from '../flags';

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

let mockSelectData: { key: string; enabled: boolean }[] | null = null;
let mockSelectError: { message: string } | null = null;
let mockQueryGym: string | null = null;

jest.mock('@/sync/supabase', () => ({
  get supabase() {
    return {
      from: (table: string) => ({
        select: (cols: string) => ({
          eq: (col: string, val: string) => {
            if (table === 'gym_flags' && col === 'gym_id') {
              mockQueryGym = val;
            }
            return Promise.resolve({ data: mockSelectData, error: mockSelectError });
          },
        }),
      }),
    };
  },
  isCloudConfigured: true,
}));

jest.mock('@/world', () => ({
  GYM: 'padrao',
}));

describe('flags store', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    mockSelectData = null;
    mockSelectError = null;
    mockQueryGym = null;
    await useFlags.getState().reset();
  });

  describe('useFlag e getFlag', () => {
    it('retorna false por padrao para chave inexistente', async () => {
      expect(getFlag('nao_existe')).toBe(false);
      const { result } = await renderHook(() => useFlag('nao_existe'));
      expect(result.current).toBe(false);
      expect(useFlags.getState().flags).toEqual({});
    });

    it('reativamente atualiza quando a flag muda na store', async () => {
      const { result } = await renderHook(() => useFlag('novidade'));
      expect(result.current).toBe(false);

      await act(async () => {
        useFlags.setState({ flags: { novidade: true } });
      });

      expect(result.current).toBe(true);
    });
  });

  describe('load', () => {
    it('carrega flags gravadas no AsyncStorage para a memoria', async () => {
      const salvas = { suggested_workouts: true, beta_feature: false };
      await AsyncStorage.setItem(storageKeyFor('padrao'), JSON.stringify(salvas));

      await useFlags.getState().load();

      expect(useFlags.getState().ready).toBe(true);
      expect(getFlag('suggested_workouts')).toBe(true);
      expect(getFlag('beta_feature')).toBe(false);
      expect(getFlag('outra')).toBe(false);
    });

    it('fica vazio e pronto quando nao ha nada no AsyncStorage', async () => {
      await useFlags.getState().load();

      expect(useFlags.getState().ready).toBe(true);
      expect(useFlags.getState().flags).toEqual({});
    });

    it('trata erro no AsyncStorage sem quebrar o app', async () => {
      jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('disco cheio'));

      await useFlags.getState().load();

      expect(useFlags.getState().ready).toBe(true);
      expect(useFlags.getState().flags).toEqual({});
    });
  });

  describe('fetchRemote', () => {
    it('busca as flags do mundo atual e persiste no AsyncStorage', async () => {
      mockSelectData = [
        { key: 'suggested_workouts', enabled: true },
        { key: 'experimental_mode', enabled: false },
      ];

      await useFlags.getState().fetchRemote();

      expect(mockQueryGym).toBe('padrao');
      expect(getFlag('suggested_workouts')).toBe(true);
      expect(getFlag('experimental_mode')).toBe(false);

      const emDisco = await AsyncStorage.getItem(storageKeyFor('padrao'));
      expect(JSON.parse(emDisco!)).toEqual({
        suggested_workouts: true,
        experimental_mode: false,
      });
    });

    it('preserva o cache local se o servidor devolver erro (ex: sem conexao)', async () => {
      // Estado anterior em cache
      useFlags.setState({ flags: { cached_flag: true } });

      mockSelectError = { message: 'Failed to fetch' };

      await useFlags.getState().fetchRemote();

      // Mantém a flag que já estava no cache
      expect(getFlag('cached_flag')).toBe(true);
      expect(useFlags.getState().loading).toBe(false);
    });
  });

  describe('storageKeyFor', () => {
    it('isola a chave do storage pelo nome da academia', () => {
      expect(storageKeyFor('padrao')).toBe('@voluma:flags:padrao');
      expect(storageKeyFor('teste')).toBe('@voluma:flags:teste');
    });
  });
});
