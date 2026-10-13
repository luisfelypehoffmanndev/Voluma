/**
 * Como dois nomes de exercicio sao comparados.
 *
 * Sem acento e sem caixa: quem digitou "triceps corda" na pressa nao pode
 * acabar com uma segunda linha ao lado de "Tríceps corda" — sao o mesmo
 * movimento, e duplicata no catalogo quebra o historico, que e por exercicio.
 */
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}
