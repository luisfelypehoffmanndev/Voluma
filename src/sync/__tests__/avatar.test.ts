import {
  avatarPathFor,
  centerSquare,
  clearAvatarCache,
  removeAvatar,
  signedAvatarUrls,
  uploadAvatar,
} from '../avatar';

/**
 * A rede e falsa, mas o que esta sob teste e real: a ORDEM das escritas. A
 * foto nova sobe e so entao o perfil aponta para ela; a antiga so e apagada
 * depois. Qualquer outra ordem deixa, numa falha no meio, um perfil apontando
 * para um arquivo que nao existe — e todos os amigos veem um buraco.
 */

type Erro = { message: string; code?: string } | null;

let mockLog: string[] = [];
let mockUploadError: Erro = null;
let mockUpdateError: Erro = null;
let mockSigned: { path: string; signedUrl: string }[] = [];
let mockSignCalls: string[][] = [];

const perfil = (avatarPath: string | null) => ({
  id: 'u1',
  handle: 'luis',
  age: null,
  training_years: null,
  shares_stats: false,
  avatar_path: avatarPath,
  display_name: null,
});

jest.mock('../supabase', () => ({
  get supabase() {
    return {
      storage: {
        from: (bucket: string) => ({
          upload: async (path: string, _body: unknown, options: { contentType: string }) => {
            mockLog.push(`upload ${bucket} ${path} ${options.contentType}`);
            return { data: mockUploadError ? null : { path }, error: mockUploadError };
          },
          remove: async (paths: string[]) => {
            mockLog.push(`remove ${bucket} ${paths.join(',')}`);
            return { data: [], error: null };
          },
          createSignedUrls: async (paths: string[], expiresIn: number) => {
            mockSignCalls.push(paths);
            mockLog.push(`sign ${expiresIn}`);
            return {
              data: paths.map((path) => ({
                path,
                signedUrl: mockSigned.find((row) => row.path === path)?.signedUrl ?? `url:${path}`,
                error: null,
              })),
              error: null,
            };
          },
        }),
      },
      from: () => ({
        update: (changes: { avatar_path: string | null }) => ({
          eq: () => ({
            select: () => ({
              single: async () => {
                mockLog.push(`update avatar_path=${changes.avatar_path}`);
                return mockUpdateError
                  ? { data: null, error: mockUpdateError }
                  : { data: perfil(changes.avatar_path), error: null };
              },
            }),
          }),
        }),
      }),
    };
  },
  isCloudConfigured: true,
}));

const bytes = new Uint8Array([0xff, 0xd8, 0xff]);

beforeEach(() => {
  mockLog = [];
  mockUploadError = null;
  mockUpdateError = null;
  mockSigned = [];
  mockSignCalls = [];
  clearAvatarCache();
});

describe('avatarPathFor', () => {
  // A pasta e o id: e o que as policies do Storage conferem.
  it('fica na pasta do dono, com o instante no nome', () => {
    expect(avatarPathFor('u1', 1727000000000)).toBe('u1/1727000000000.jpg');
  });
});

describe('centerSquare', () => {
  it('recorta o meio de uma foto em pe', () => {
    expect(centerSquare(1000, 1600)).toEqual({ originX: 0, originY: 300, width: 1000, height: 1000 });
  });

  it('recorta o meio de uma foto deitada', () => {
    expect(centerSquare(1600, 1000)).toEqual({ originX: 300, originY: 0, width: 1000, height: 1000 });
  });

  it('foto ja quadrada fica inteira', () => {
    expect(centerSquare(800, 800)).toEqual({ originX: 0, originY: 0, width: 800, height: 800 });
  });
});

describe('uploadAvatar', () => {
  it('sobe, aponta o perfil e so entao apaga a antiga', async () => {
    const profile = await uploadAvatar('u1', bytes, 'u1/1.jpg', 1727000000000);

    expect(mockLog).toEqual([
      'upload avatars u1/1727000000000.jpg image/jpeg',
      'update avatar_path=u1/1727000000000.jpg',
      'remove avatars u1/1.jpg',
    ]);
    expect(profile.avatarPath).toBe('u1/1727000000000.jpg');
  });

  it('sem foto anterior, nao apaga nada', async () => {
    await uploadAvatar('u1', bytes, null, 1727000000000);
    expect(mockLog.some((line) => line.startsWith('remove'))).toBe(false);
  });

  it('falha no envio nao mexe no perfil nem na foto antiga', async () => {
    mockUploadError = { message: 'Sem conexão' };

    await expect(uploadAvatar('u1', bytes, 'u1/1.jpg', 1727000000000)).rejects.toThrow(
      'Sem conexão',
    );
    expect(mockLog).toEqual(['upload avatars u1/1727000000000.jpg image/jpeg']);
  });

  // O arquivo novo subiu mas o perfil nao aponta para ele: sobraria um arquivo
  // orfao que ninguem mais apaga. E a antiga continua valendo.
  it('falha ao gravar o perfil apaga o arquivo novo e mantem o antigo', async () => {
    mockUpdateError = { message: 'Sem conexão' };

    await expect(uploadAvatar('u1', bytes, 'u1/1.jpg', 1727000000000)).rejects.toThrow(
      'Sem conexão',
    );
    expect(mockLog).toEqual([
      'upload avatars u1/1727000000000.jpg image/jpeg',
      'update avatar_path=u1/1727000000000.jpg',
      'remove avatars u1/1727000000000.jpg',
    ]);
  });
});

describe('removeAvatar', () => {
  it('tira do perfil primeiro e depois apaga o arquivo', async () => {
    const profile = await removeAvatar('u1', 'u1/1.jpg');

    expect(mockLog).toEqual(['update avatar_path=null', 'remove avatars u1/1.jpg']);
    expect(profile.avatarPath).toBeNull();
  });
});

describe('signedAvatarUrls', () => {
  it('assina todas as fotos da tela numa chamada so', async () => {
    const urls = await signedAvatarUrls(['u1/1.jpg', 'u2/1.jpg']);

    expect(mockSignCalls).toEqual([['u1/1.jpg', 'u2/1.jpg']]);
    expect(urls.get('u2/1.jpg')).toBe('url:u2/1.jpg');
  });

  it('reaproveita a URL ainda valida em vez de assinar de novo', async () => {
    await signedAvatarUrls(['u1/1.jpg'], 1_000);
    await signedAvatarUrls(['u1/1.jpg', 'u2/1.jpg'], 2_000);

    expect(mockSignCalls).toEqual([['u1/1.jpg'], ['u2/1.jpg']]);
  });

  it('assina de novo quando a URL esta perto de vencer', async () => {
    await signedAvatarUrls(['u1/1.jpg'], 0);
    await signedAvatarUrls(['u1/1.jpg'], 58 * 60 * 1000);

    expect(mockSignCalls).toEqual([['u1/1.jpg'], ['u1/1.jpg']]);
  });

  it('sem fotos, nao vai a rede', async () => {
    expect((await signedAvatarUrls([])).size).toBe(0);
    expect(mockSignCalls).toEqual([]);
  });

  it('ignora caminhos repetidos', async () => {
    await signedAvatarUrls(['u1/1.jpg', 'u1/1.jpg']);
    expect(mockSignCalls).toEqual([['u1/1.jpg']]);
  });
});
