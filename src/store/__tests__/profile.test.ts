import type { Profile } from '@/domain/types';

import { useProfile } from '../profile';

jest.mock('@/sync/profile', () => ({
  fetchProfile: jest.fn(),
  claimHandle: jest.fn(),
  updateProfile: jest.fn(),
}));

const sync = jest.requireMock('@/sync/profile') as {
  fetchProfile: jest.Mock;
  claimHandle: jest.Mock;
  updateProfile: jest.Mock;
};

jest.mock('@/sync/avatar', () => ({
  uploadAvatar: jest.fn(),
  removeAvatar: jest.fn(),
}));

const avatar = jest.requireMock('@/sync/avatar') as {
  uploadAvatar: jest.Mock;
  removeAvatar: jest.Mock;
};

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'u1',
    handle: 'luis',
    age: null,
    trainingYears: null,
    sharesStats: false,
    avatarPath: null,
    displayName: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  useProfile.getState().clear();
});

describe('load', () => {
  it('guarda o perfil que veio do servidor', async () => {
    sync.fetchProfile.mockResolvedValue(makeProfile({ age: 28 }));

    await useProfile.getState().load('u1');

    expect(useProfile.getState().profile).toMatchObject({ handle: 'luis', age: 28 });
  });

  it('deixa o perfil nulo quando a pessoa ainda nao criou o dela', async () => {
    sync.fetchProfile.mockResolvedValue(null);

    await useProfile.getState().load('u1');

    expect(useProfile.getState().profile).toBeNull();
  });

  // Sem rede no primeiro login o app nao pode travar: o erro fica guardado para
  // a tela oferecer "tentar de novo", e `loading` precisa voltar a false ou o
  // card fica girando para sempre.
  it('guarda o erro e sai de loading quando a rede falha', async () => {
    sync.fetchProfile.mockRejectedValue(new Error('Sem conexão'));

    await useProfile.getState().load('u1');

    expect(useProfile.getState().error).toBe('Sem conexão');
    expect(useProfile.getState().loading).toBe(false);
    expect(useProfile.getState().profile).toBeNull();
  });
});

describe('claim', () => {
  it('guarda o perfil criado', async () => {
    sync.claimHandle.mockResolvedValue(makeProfile({ handle: 'luis2' }));

    const resultado = await useProfile.getState().claim('u1', ['luis', 'luis2'], {});

    expect(resultado).toBe('ok');
    expect(useProfile.getState().profile).toMatchObject({ handle: 'luis2' });
  });

  it('devolve handle-taken sem guardar perfil nenhum', async () => {
    sync.claimHandle.mockResolvedValue('handle-taken');

    const resultado = await useProfile.getState().claim('u1', ['luis'], {});

    expect(resultado).toBe('handle-taken');
    expect(useProfile.getState().profile).toBeNull();
  });

  it('devolve erro quando a rede falha, sem derrubar o app', async () => {
    sync.claimHandle.mockRejectedValue(new Error('Sem conexão'));

    expect(await useProfile.getState().claim('u1', ['luis'], {})).toBe('error');
  });
});

describe('save', () => {
  it('troca o perfil guardado pelo atualizado', async () => {
    sync.fetchProfile.mockResolvedValue(makeProfile());
    await useProfile.getState().load('u1');

    sync.updateProfile.mockResolvedValue(makeProfile({ handle: 'novo', age: 31 }));
    const resultado = await useProfile.getState().save({ handle: 'novo', age: 31 });

    expect(resultado).toBe('ok');
    expect(useProfile.getState().profile).toMatchObject({ handle: 'novo', age: 31 });
  });

  it('mantem o perfil anterior quando o handle novo esta ocupado', async () => {
    sync.fetchProfile.mockResolvedValue(makeProfile());
    await useProfile.getState().load('u1');

    sync.updateProfile.mockResolvedValue('handle-taken');
    const resultado = await useProfile.getState().save({ handle: 'ocupado' });

    expect(resultado).toBe('handle-taken');
    expect(useProfile.getState().profile).toMatchObject({ handle: 'luis' });
  });

  it('nao chama a rede quando nao ha perfil para atualizar', async () => {
    expect(await useProfile.getState().save({ handle: 'novo' })).toBe('error');
    expect(sync.updateProfile).not.toHaveBeenCalled();
  });
});

describe('load com o nome do Google', () => {
  it('preenche o nome quando o perfil ainda nao tem', async () => {
    sync.fetchProfile.mockResolvedValue(makeProfile({ displayName: null }));
    sync.updateProfile.mockResolvedValue(makeProfile({ displayName: 'Luis Felype' }));

    await useProfile.getState().load('u1', '  Luis Felype ');

    expect(sync.updateProfile).toHaveBeenCalledWith('u1', { displayName: 'Luis Felype' });
    expect(useProfile.getState().profile?.displayName).toBe('Luis Felype');
  });

  // O nome que a pessoa escolheu vale mais que o da conta Google.
  it('nao sobrescreve um nome ja escolhido', async () => {
    sync.fetchProfile.mockResolvedValue(makeProfile({ displayName: 'Lu' }));

    await useProfile.getState().load('u1', 'Luis Felype');

    expect(sync.updateProfile).not.toHaveBeenCalled();
    expect(useProfile.getState().profile?.displayName).toBe('Lu');
  });

  it('sem perfil (sem @ ainda) nao grava nada', async () => {
    sync.fetchProfile.mockResolvedValue(null);

    await useProfile.getState().load('u1', 'Luis Felype');

    expect(sync.updateProfile).not.toHaveBeenCalled();
  });

  // Nome e enfeite do ranking: falhar ao grava-lo nao pode derrubar o perfil.
  it('falha ao gravar o nome mantem o perfil carregado, sem erro na tela', async () => {
    sync.fetchProfile.mockResolvedValue(makeProfile({ displayName: null }));
    sync.updateProfile.mockRejectedValue(new Error('Sem conexão'));

    await useProfile.getState().load('u1', 'Luis Felype');

    expect(useProfile.getState().profile?.handle).toBe('luis');
    expect(useProfile.getState().error).toBeNull();
  });
});

describe('setAvatar', () => {
  const jpeg = new Uint8Array([0xff, 0xd8]);

  it('sobe a foto passando a anterior, para ela ser apagada depois', async () => {
    sync.fetchProfile.mockResolvedValue(makeProfile({ avatarPath: 'u1/1.jpg' }));
    await useProfile.getState().load('u1');
    avatar.uploadAvatar.mockResolvedValue(makeProfile({ avatarPath: 'u1/2.jpg' }));

    expect(await useProfile.getState().setAvatar(jpeg)).toBe('ok');
    expect(avatar.uploadAvatar).toHaveBeenCalledWith('u1', jpeg, 'u1/1.jpg');
    expect(useProfile.getState().profile?.avatarPath).toBe('u1/2.jpg');
  });

  it('falha mantem a foto antiga na tela e mostra o erro', async () => {
    sync.fetchProfile.mockResolvedValue(makeProfile({ avatarPath: 'u1/1.jpg' }));
    await useProfile.getState().load('u1');
    avatar.uploadAvatar.mockRejectedValue(new Error('Sem conexão'));

    expect(await useProfile.getState().setAvatar(jpeg)).toBe('error');
    expect(useProfile.getState().profile?.avatarPath).toBe('u1/1.jpg');
    expect(useProfile.getState().error).toBe('Sem conexão');
    expect(useProfile.getState().loading).toBe(false);
  });

  it('sem perfil carregado nao vai a rede', async () => {
    expect(await useProfile.getState().setAvatar(jpeg)).toBe('error');
    expect(avatar.uploadAvatar).not.toHaveBeenCalled();
  });
});

describe('removeAvatar', () => {
  it('remove a foto atual', async () => {
    sync.fetchProfile.mockResolvedValue(makeProfile({ avatarPath: 'u1/1.jpg' }));
    await useProfile.getState().load('u1');
    avatar.removeAvatar.mockResolvedValue(makeProfile({ avatarPath: null }));

    expect(await useProfile.getState().removeAvatar()).toBe('ok');
    expect(avatar.removeAvatar).toHaveBeenCalledWith('u1', 'u1/1.jpg');
    expect(useProfile.getState().profile?.avatarPath).toBeNull();
  });

  it('sem foto nao ha o que remover', async () => {
    sync.fetchProfile.mockResolvedValue(makeProfile({ avatarPath: null }));
    await useProfile.getState().load('u1');

    expect(await useProfile.getState().removeAvatar()).toBe('error');
    expect(avatar.removeAvatar).not.toHaveBeenCalled();
  });
});

/**
 * O signOut apaga o banco local; sem limpar este store junto, o handle de uma
 * conta continuaria na tela para a proxima pessoa que entrasse no aparelho.
 */
describe('clear', () => {
  it('zera perfil e erro', async () => {
    sync.fetchProfile.mockResolvedValue(makeProfile());
    await useProfile.getState().load('u1');

    useProfile.getState().clear();

    expect(useProfile.getState().profile).toBeNull();
    expect(useProfile.getState().error).toBeNull();
  });
});
