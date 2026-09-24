import { applyOrder } from '../order';

const items = (...ids: string[]) => ids.map((id) => ({ id }));
const ids = (list: { id: string }[]) => list.map((item) => item.id);
const key = (item: { id: string }) => item.id;

describe('applyOrder', () => {
  it('sem ordem salva, mantem a ordem natural', () => {
    expect(ids(applyOrder(items('a', 'b', 'c'), [], key))).toEqual(['a', 'b', 'c']);
  });

  it('segue a ordem salva', () => {
    expect(ids(applyOrder(items('a', 'b', 'c'), ['c', 'a', 'b'], key))).toEqual(['c', 'a', 'b']);
  });

  it('item que nao estava na ordem vai para o fim, na ordem natural', () => {
    expect(ids(applyOrder(items('x', 'a', 'y', 'b'), ['b', 'a'], key))).toEqual([
      'b',
      'a',
      'x',
      'y',
    ]);
  });

  it('ignora chave que nao existe mais', () => {
    expect(ids(applyOrder(items('a', 'b'), ['gone', 'b', 'a'], key))).toEqual(['b', 'a']);
  });

  it('chave repetida na ordem conta pela primeira ocorrencia', () => {
    expect(ids(applyOrder(items('a', 'b', 'c'), ['b', 'c', 'b', 'a'], key))).toEqual([
      'b',
      'c',
      'a',
    ]);
  });

  it('nao muta a lista de entrada', () => {
    const input = items('a', 'b');
    applyOrder(input, ['b', 'a'], key);
    expect(ids(input)).toEqual(['a', 'b']);
  });
});
