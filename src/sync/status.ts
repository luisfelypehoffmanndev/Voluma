/**
 * A linha de status da nuvem no Perfil.
 *
 * Com mudancas na fila, o erro aparece JUNTO da contagem: escondido atras dela,
 * a fila crescia (como quando o projeto foi pausado) e o motivo nunca aparecia.
 */
export function syncStatusText(syncing: boolean, pending: number, error: string | null): string {
  if (syncing) return 'sincronizando…';
  if (pending > 0) {
    const count = `${pending} ${pending === 1 ? 'mudança pendente' : 'mudanças pendentes'}`;
    return error ? `${count} · ${error}` : count;
  }
  return error ?? 'tudo sincronizado';
}
