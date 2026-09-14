import { countUpValue } from '../countUp';

describe('countUpValue', () => {
  it('progresso 0 devolve o valor de origem', () => {
    expect(countUpValue(3200, 5000, 0)).toBe(3200);
  });

  it('progresso 1 devolve o valor de destino', () => {
    expect(countUpValue(3200, 5000, 1)).toBe(5000);
  });

  it('meio do caminho subindo', () => {
    expect(countUpValue(3200, 5000, 0.5)).toBe(4100);
  });

  it('meio do caminho descendo — a mesma funcao serve pras duas direcoes', () => {
    expect(countUpValue(5000, 3200, 0.5)).toBe(4100);
  });

  it('progresso negativo fica grampeado na origem', () => {
    expect(countUpValue(3200, 5000, -0.2)).toBe(3200);
  });

  it('progresso acima de 1 fica grampeado no destino', () => {
    expect(countUpValue(3200, 5000, 1.2)).toBe(5000);
  });

  it('origem igual ao destino e estavel em qualquer progresso', () => {
    expect(countUpValue(4000, 4000, 0.3)).toBe(4000);
    expect(countUpValue(4000, 4000, 0.7)).toBe(4000);
  });

  it('arredonda o valor fracionario intermediario', () => {
    expect(countUpValue(3200, 3201, 0.5)).toBe(3201); // 3200.5 arredonda pra cima
  });
});
