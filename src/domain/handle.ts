/**
 * O @handle: o identificador publico de uma pessoa no app.
 *
 * Existe porque e-mail nao serve como chave social — expor um num fluxo de
 * "adicionar amigo" vaza dado sensivel e deixa qualquer um testar se alguem tem
 * conta. O handle e o oposto: a pessoa escolhe justamente para ser visto.
 *
 * A regra do alfabeto esta escrita tres vezes — aqui, no `check` de
 * `supabase/schema.sql` e no indice unico sobre `lower(handle)`. O teste de
 * guarda em `__tests__/handle.test.ts` e o que impede as duas primeiras de
 * divergirem.
 */

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 20;

const VALID = new RegExp(`^[a-z0-9._]{${HANDLE_MIN},${HANDLE_MAX}}$`);

/** Quando nem o nome da conta nem o e-mail rendem um handle utilizavel. */
const FALLBACK = 'atleta';

/** Quantos candidatos a fila leva antes de desistir. */
const CANDIDATES = 10;

/**
 * Reduz qualquer entrada ao alfabeto do handle.
 *
 * Acento sai por decomposicao (NFD) e nao por descarte: "Luís" tem que virar
 * "luis", nao "lus". O espaco vira ponto antes do descarte, senao "Luis Felype"
 * colaria em "luisfelype" e perderia a separacao que a pessoa escreveu.
 */
export function normalizeHandle(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    // Corrida de espacos vira UM ponto: dois pontos seguidos leem como erro de
    // digitacao, e a pessoa nao escreveu ponto nenhum.
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._]/g, '');
}

/**
 * Espelha o `check` do Postgres. Recebe handle ja normalizado — normalizar por
 * dentro faria a tela aceitar o que o banco recusa.
 */
export function isValidHandle(handle: string): boolean {
  return VALID.test(handle);
}

/**
 * A fila de tentativas do primeiro login.
 *
 * O client nao pergunta ao banco se o handle esta livre antes de gravar:
 * perguntar nao fecha a corrida entre duas pessoas pedindo o mesmo handle no
 * mesmo instante, so encurta a janela. Quem decide e o indice unico — esta
 * funcao so decide em que ordem tentar.
 */
export function handleCandidates(displayName: string, email: string): string[] {
  const base = pickBase(displayName, email);

  return Array.from({ length: CANDIDATES }, (_, index) => {
    const suffix = index === 0 ? '' : String(index + 1);
    // Trunca com o sufixo ja descontado. Truncar em HANDLE_MAX e so entao colar
    // o sufixo produziria um handle acima do teto — recusado pelo banco no
    // primeiro login, que e o pior momento para isso aparecer.
    return base.slice(0, HANDLE_MAX - suffix.length) + suffix;
  });
}

/** Nome da conta, e-mail, ou o fallback — o primeiro que render handle valido. */
function pickBase(displayName: string, email: string): string {
  // Dois primeiros nomes, nao o nome inteiro: "luis.felype.hoffmann" gasta a
  // cota de 20 caracteres sem identificar melhor do que "luis.felype".
  const fromName = normalizeHandle(displayName.trim().split(/\s+/).slice(0, 2).join(' '));
  if (isValidHandle(fromName)) return fromName;

  const fromEmail = normalizeHandle(email.split('@')[0] ?? '');
  if (isValidHandle(fromEmail)) return fromEmail;

  return FALLBACK;
}
