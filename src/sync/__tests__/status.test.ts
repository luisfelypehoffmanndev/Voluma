import { syncStatusText } from '../status';

describe('syncStatusText', () => {
  it('sincronizando vence tudo', () => {
    expect(syncStatusText(true, 3, 'Sem conexão')).toBe('sincronizando…');
  });

  // Foi o caso real com o projeto pausado: a fila crescia e o motivo sumia.
  it('com fila e erro, mostra os dois', () => {
    expect(syncStatusText(false, 3, 'Sem conexão')).toBe('3 mudanças pendentes · Sem conexão');
    expect(syncStatusText(false, 1, 'Sem conexão')).toBe('1 mudança pendente · Sem conexão');
  });

  it('com fila e sem erro, so a contagem', () => {
    expect(syncStatusText(false, 2, null)).toBe('2 mudanças pendentes');
  });

  it('sem fila, o erro ou tudo sincronizado', () => {
    expect(syncStatusText(false, 0, 'Sem conexão')).toBe('Sem conexão');
    expect(syncStatusText(false, 0, null)).toBe('tudo sincronizado');
  });
});
