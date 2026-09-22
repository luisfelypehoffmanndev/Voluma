import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';

import { ProfileForm } from '../ProfileForm';

/**
 * O unico teste de render do projeto, e existe por um motivo especifico: e aqui
 * que a regra do handle (dominio), o campo de texto (tela) e a recusa do banco
 * se encontram. Testar so a funcao pura deixaria de fora justamente a parte que
 * mais erra — deixar salvar o que o `check` do Postgres vai recusar.
 *
 * Pelo mesmo motivo cobre o `Stepper` digitavel da idade e dos anos: a regra de
 * sair do "em branco" so existe no encontro do stepper com o formulario.
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

/**
 * Idade e anos de treino saem do "em branco" de dois jeitos: o "+" pousa num
 * valor plausivel, e o numero digitado vale como foi digitado. Sem distinguir
 * os dois, digitar 45 a partir do em branco virava 25.
 */
describe('idade e anos de treino', () => {
  // Troca o texto inteiro de uma vez: no aparelho o `selectTextOnFocus` faz a
  // primeira tecla substituir o numero antigo, e o `user.clear` da biblioteca
  // termina com um blur que fecharia a edicao antes da digitacao.
  async function digitar(user: ReturnType<typeof userEvent.setup>, rotulo: string, texto: string) {
    await user.press(screen.getByLabelText(`Digitar ${rotulo.toLowerCase()}`));
    const campoNumero = screen.getByLabelText(rotulo);
    await fireEvent.changeText(campoNumero, texto);
    await fireEvent(campoNumero, 'submitEditing');
  }

  it('o + a partir do em branco pousa no valor de partida', async () => {
    const { onSubmit, user } = await setup();

    await user.press(screen.getByLabelText('Aumentar idade'));
    await user.press(salvar());

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ age: 25 }));
  });

  it('digitar a partir do em branco usa o numero digitado', async () => {
    const { onSubmit, user } = await setup();

    await digitar(user, 'Idade', '45');
    await user.press(salvar());

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ age: 45 }));
  });

  // "Acabei de comecar" e uma resposta, nao um toque acidental no +.
  it('zero anos de treino digitado fica zero', async () => {
    const { onSubmit, user } = await setup();

    await digitar(user, 'Anos de treino', '0');
    await user.press(salvar());

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ trainingYears: 0 }));
  });

  it('trunca o que foi digitado com casa decimal', async () => {
    const { onSubmit, user } = await setup({ initialTrainingYears: 2 });

    await digitar(user, 'Anos de treino', '3,7');
    await user.press(salvar());

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ trainingYears: 3 }));
  });

  it('idade abaixo do minimo volta para o em branco', async () => {
    const { onSubmit, user } = await setup({ initialAge: 30 });

    await digitar(user, 'Idade', '5');
    await user.press(salvar());

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ age: null }));
  });
});
