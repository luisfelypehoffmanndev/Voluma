import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { NAME_MAX } from '@/domain/friends';
import { HANDLE_MAX, HANDLE_MIN, isValidHandle, normalizeHandle } from '@/domain/handle';
import { colors, fontSize, radius, spacing, surfaces } from '@/theme/tokens';

import { PressableSurface } from '../PressableSurface';
import { Stepper } from '../Stepper';
import { Body, Label, Meta } from '../Text';

/**
 * O formulario do perfil publico, usado tanto no primeiro login quanto na
 * edicao depois.
 *
 * Componente burro de proposito: recebe valores e devolve valores. Quem grava,
 * quem sabe o id da conta e quem trata a recusa do banco e a tela — assim a
 * regra do handle pode ser testada sem rede e sem router.
 */

/** Idade e anos de treino sao opcionais; isto marca "ainda nao respondeu". */
const UNSET = -1;

/** Onde o stepper aterrissa no primeiro toque, em vez de UNSET + 1. */
const AGE_START = 25;
const YEARS_START = 1;

export type ProfileValues = {
  /** Nulo quando em branco: quem nao tem nome aparece pelo @. */
  displayName: string | null;
  handle: string;
  age: number | null;
  trainingYears: number | null;
};

type Props = {
  initialName: string;
  initialHandle: string;
  initialAge: number | null;
  initialTrainingYears: number | null;
  submitLabel: string;
  /** O banco recusou o handle: ja e de outra pessoa. */
  taken?: boolean;
  /** Gravacao no ar — trava o botao para nao enviar duas vezes. */
  busy?: boolean;
  onSubmit: (values: ProfileValues) => void;
};

export function ProfileForm({
  initialName,
  initialHandle,
  initialAge,
  initialTrainingYears,
  submitLabel,
  taken = false,
  busy = false,
  onSubmit,
}: Props) {
  const [name, setName] = useState(initialName);
  const [handle, setHandle] = useState(initialHandle);
  const [age, setAge] = useState(initialAge ?? UNSET);
  const [years, setYears] = useState(initialTrainingYears ?? UNSET);

  const short = handle.length > 0 && !isValidHandle(handle);
  const empty = handle.length === 0;

  const submit = () => {
    if (busy || !isValidHandle(handle)) return;
    onSubmit({
      displayName: name.trim() === '' ? null : name.trim().replace(/\s+/g, ' '),
      handle,
      age: age === UNSET ? null : age,
      trainingYears: years === UNSET ? null : years,
    });
  };

  return (
    <View style={styles.form}>
      <View>
        <Label>Seu nome</Label>
        <View style={styles.field}>
          <TextInput
            accessibilityLabel="Nome"
            style={styles.input}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoComplete="name"
            maxLength={NAME_MAX}
            placeholder="como seus amigos te chamam"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="next"
          />
        </View>
        <Meta>no ranking aparece só o primeiro nome</Meta>
      </View>

      <View>
        <Label>Seu @</Label>
        <View style={styles.field}>
          <Body style={styles.at}>@</Body>
          <TextInput
            accessibilityLabel="@handle"
            style={styles.input}
            // Normaliza a cada tecla, e nao so ao salvar: assim a pessoa ve o
            // que vai ser gravado enquanto digita, em vez de ver o proprio
            // texto mudar sozinho depois de tocar em salvar.
            value={handle}
            // O espaco vira ponto ANTES de normalizar. Dentro de um campo em
            // uso, o espaco que acabou de ser digitado e o separador que a
            // pessoa esta escrevendo — nao sobra de digitacao. Sem isto o
            // `trim()` do dominio comeria a tecla e "luis felype" nunca
            // chegaria a "luis.felype".
            onChangeText={(text) => setHandle(normalizeHandle(text.replace(/\s/g, '.')))}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={HANDLE_MAX}
            placeholder="seuapelido"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
        </View>

        {/* Sem cor de estado: o brief proibe vermelho de erro, entao o que
            corrige e o texto. */}
        <Meta>{hint({ empty, short, taken })}</Meta>
      </View>

      <Stepper
        label="Idade"
        layout="row"
        value={age}
        min={UNSET}
        max={120}
        editable
        integer
        format={(value) => (value === UNSET ? '—' : String(value))}
        onChange={(next, source) => setAge(land(age, next, AGE_START, 13, source))}
      />

      <Stepper
        label="Anos de treino"
        layout="row"
        value={years}
        min={UNSET}
        max={80}
        editable
        integer
        format={(value) => (value === UNSET ? '—' : String(value))}
        onChange={(next, source) => setYears(land(years, next, YEARS_START, 0, source))}
      />

      <PressableSurface
        disabled={busy}
        onPress={submit}
        pressedOpacity={0.8}
        borderRadius={radius.pill}
        style={styles.submit}
      >
        <Body>{submitLabel}</Body>
      </PressableSurface>
    </View>
  );
}

/**
 * Onde o stepper aterrissa, dado que "vazio" mora um passo abaixo do minimo
 * real do campo.
 *
 * Subindo a partir do vazio, cai num valor plausivel em vez de `UNSET + 1`.
 * Descendo abaixo do minimo, volta ao vazio em vez de parar num numero que o
 * `check` do banco recusaria.
 */
/**
 * Sai do "em branco" (UNSET) de um jeito, entra de outro.
 *
 * Um toque no "+" a partir do em branco pousa num valor plausivel (`start`),
 * nao em UNSET + 1 — ninguem tem "0 anos de treino" so porque tocou uma vez.
 * Um numero digitado e diferente: quem digitou ja escolheu o valor, entao usa
 * o que foi digitado direto, sem pousar em lugar nenhum — so `source` diz qual
 * dos dois aconteceu.
 *
 * Descer abaixo do piso (`floor`) sempre volta para UNSET, tocando ou
 * digitando: um numero fora do que faz sentido (idade negativa) e o mesmo que
 * nao ter respondido.
 */
function land(
  current: number,
  next: number,
  start: number,
  floor: number,
  source: 'step' | 'type',
): number {
  if (current === UNSET && source === 'step') return next > current ? start : UNSET;
  return next < floor ? UNSET : next;
}

function hint({ empty, short, taken }: { empty: boolean; short: boolean; taken: boolean }): string {
  if (taken) return 'esse @ já é de outra pessoa, escolha outro';
  if (empty) return `${HANDLE_MIN} a ${HANDLE_MAX} caracteres · letras, números, ponto`;
  if (short) return `${HANDLE_MIN} a ${HANDLE_MAX} caracteres · letras, números, ponto`;
  return 'é assim que seus amigos vão te achar';
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.lg,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  at: {
    fontSize: fontSize.bodyLg,
    color: colors.textSecondary,
  },
  input: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: fontSize.bodyLg,
    color: colors.textPrimary,
  },
  submit: {
    height: 54,
    borderRadius: radius.pill,
    backgroundColor: surfaces.raised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
