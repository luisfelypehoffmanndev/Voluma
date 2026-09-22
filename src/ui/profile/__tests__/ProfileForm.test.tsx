import { render, screen, userEvent } from '@testing-library/react-native';

import { ProfileForm } from '../ProfileForm';

/**
 * O unico teste de render do projeto, e existe por um motivo especifico: e aqui
 * que a regra do handle (dominio), o campo de texto (tela) e a recusa do banco
 * se encontram. Testar so a funcao pura deixaria de fora justamente a parte que
 * mais erra — deixar salvar o que o `check` do Postgres vai recusar.
 */

async function setup(overrides: Partial<React.ComponentProps<typeof ProfileForm>> = {}) {
  const onSubmit = jest.fn();
  const user = userEvent.setup();

  await render(
    <ProfileForm
      initialHandle="luisfelype"
      initialAge={null}
      initialTrainingYears={null}
      submitLabel="Salvar"
      onSubmit={onSubmit}
      {...overrides}
    />,
  );

  return { onSubmit, user };
}

const campo = () => screen.getByLabelText('@handle');
const salvar = () => screen.getByText('Salvar');

describe('ProfileForm', () => {
  it('envia o handle sugerido sem a pessoa digitar nada', async () => {
    const { onSubmit, user } = await setup();

    await user.press(salvar());

    expect(onSubmit).toHaveBeenCalledWith({
      handle: 'luisfelype',
      age: null,
      trainingYears: null,
    });
  });

  it('normaliza o que foi digitado antes de enviar', async () => {
    const { onSubmit, user } = await setup();

    await user.clear(campo());
    await user.type(campo(), 'Luís Felype');
    await user.press(salvar());

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ handle: 'luis.felype' }));
  });

  it('nao envia handle curto demais', async () => {
    const { onSubmit, user } = await setup();

    await user.clear(campo());
    await user.type(campo(), 'lu');
    await user.press(salvar());

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('nao envia handle vazio', async () => {
    const { onSubmit, user } = await setup();

    await user.clear(campo());
    await user.press(salvar());

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('explica por que o handle curto nao serve, em texto', async () => {
    const { user } = await setup();

    await user.clear(campo());
    await user.type(campo(), 'lu');

    expect(screen.getByText(/3 a 20/)).toBeTruthy();
  });

  it('volta a aceitar depois de corrigir', async () => {
    const { onSubmit, user } = await setup();

    await user.clear(campo());
    await user.type(campo(), 'lu');
    await user.clear(campo());
    await user.type(campo(), 'luis');
    await user.press(salvar());

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ handle: 'luis' }));
  });

  it('mostra que o handle e de outra pessoa quando o banco recusou', async () => {
    await setup({ taken: true });

    expect(screen.getByText(/já é de outra pessoa/)).toBeTruthy();
  });

  it('nao envia de novo enquanto a gravacao anterior esta no ar', async () => {
    const { onSubmit, user } = await setup({ busy: true });

    await user.press(salvar());

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
