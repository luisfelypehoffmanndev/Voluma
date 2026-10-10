import { DEFAULT_GYM, gymFromPackage, schemeFor } from '../world';

describe('gymFromPackage', () => {
  it('o app da loja e o mundo padrao', () => {
    expect(gymFromPackage('com.luisf.voluma')).toBe(DEFAULT_GYM);
  });

  it('o app de uma academia e o mundo dela', () => {
    expect(gymFromPackage('com.luisf.voluma.smartfit')).toBe('smartfit');
  });

  // Testes e Expo Go nao tem o package do Voluma: caem no padrao, como o app da loja.
  it.each([null, undefined, '', 'host.exp.exponent'])('%p cai no padrao', (pkg) => {
    expect(gymFromPackage(pkg)).toBe(DEFAULT_GYM);
  });

  // So o prefixo com ponto conta: um package parecido nao vira academia.
  it('nao confunde um package que so comeca igual', () => {
    expect(gymFromPackage('com.luisf.volumaextra')).toBe(DEFAULT_GYM);
  });
});

describe('schemeFor', () => {
  // O padrao mantem o redirect que ja esta liberado no Supabase.
  it('o padrao continua voluma', () => {
    expect(schemeFor(DEFAULT_GYM)).toBe('voluma');
  });

  it('cada academia tem o proprio scheme, para o login voltar ao app certo', () => {
    expect(schemeFor('smartfit')).toBe('voluma-smartfit');
  });
});
