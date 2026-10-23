# 19 — Painel web da academia (esboço)

**Depende de:** [18](18-painel-admin.md) (backend pronto e no Supabase)
**Estado:** passos 1 a 3 feitos (2026-10-23), em `web/`. O guia do painel, com telas, fluxos e código, está em [`web/README.md`](../web/README.md).
- **Passos 1 e 2:** login com Google, escolha de academia, "Sem acesso", lista de alunos com filtros e a semana de um aluno. Vite + React + TypeScript, CSS próprio com os tokens do `design.md`, sem biblioteca de UI.
- **Passo 3** (o editor de um dia) entrou pelo [plano 20](20-planos.md), junto com a aba Planos: personalizar, editar e voltar ao plano.
- **Modo demo** (`?demo`): o painel com dados de mentira em memória, sem login.
- **Testes:** 17 no Vitest, nas regras puras e nas rotas. Os fluxos passaram num Chromium headless, no modo demo e com o Supabase simulado.

**Falta:** testar o login de verdade (precisa da URL do painel nas Redirect URLs do Supabase) e os passos 4 em diante.

### Como rodar

```sh
cd web
npm install
npm run dev     # http://localhost:5173
npm test
```

O painel lê o `.env` da raiz (mesma URL e chave publicável do app). Para o login com Google voltar para o painel, `http://localhost:5173/**` (e depois o domínio de produção) precisa estar em **Authentication → URL Configuration → Redirect URLs** no Supabase. Sem isso, o Supabase cai na Site URL, que é o app.

### Decisões tomadas

- **Vite + React + CSS próprio**, sem shadcn/Tailwind: o visual sai do `design.md` e não de uma biblioteca.
- **Rotas no hash** (`#/alunos`, `#/aluno/<id>`): funciona em qualquer hospedagem estática, sem configurar reescrita.
- **Nome e cor da academia vêm de `gyms/<slug>/config.json`**, como no build do app. A tabela `gyms` continua fechada.
- **Entrar no painel aceita o convite:** a primeira chamada é `staff_claim_invites`, que também devolve as academias da pessoa.
- **`web/` fica fora do TypeScript, do Jest e do lint da raiz**, porque usa DOM e não React Native. Do domínio do app, só módulos puros (`@domain/week`, `@domain/types`).

## Para que serve

A academia que compra o Voluma ganha um site em que o admin e os instrutores:

- veem os alunos e quanto cada um está treinando;
- montam ou mudam o treino de um aluno;
- fazem mudanças em lote (a polia quebrou → troca a "Puxada alta" de todo mundo);
- cuidam das fichas sugeridas e da equipe.

Hoje tudo isso só é possível pelo SQL Editor. O backend inteiro já existe (plano 18): o painel é uma casca em volta das RPCs `staff_*`.

## Ideia de stack

- **Web app separado, no mesmo repositório** (`web/`), para reaproveitar `src/domain`: nomes e limites de séries e reps, biblioteca de movimentos e a regra do dia treinado.
- **Vite + React + supabase-js.** O painel é uma área logada, sem SEO, então não precisa de servidor próprio: fica estático, numa hospedagem simples (Vercel, Netlify ou Cloudflare Pages).
- **Visual:** o mesmo espírito do `Design/design.md` (escuro, sóbrio), adaptado para tela grande com tabelas. Fica para o plano do front.

## Login

- Google pelo Supabase, igual ao app. A URL do painel precisa entrar nas Redirect URLs do Supabase e no Google Cloud.
- Ao entrar: `staff_claim_invites()` transforma os convites em equipe, e a linha própria em `gym_staff` diz de quais academias a pessoa é equipe. Quem não é de nenhuma vê "Sem acesso".
- Pessoa em mais de uma academia escolhe qual quer ver.

## Telas mínimas

| Tela | O que faz | RPC / leitura |
|---|---|---|
| Alunos | lista com filtros (ficha, frequência, exercício, inativos) e marcação de "editado pelo aluno" | `staff_find_students` |
| Aluno | a semana dele, dia a dia, e o editor de um dia (exercícios, ordem, séries, reps) | leitura de `routines`/`routine_exercises`/`exercises`; `staff_set_day`, `staff_clear_day`, `staff_release_day` |
| Troca em lote | escolher alunos pelo filtro, escolher de → para, ver a prévia e aplicar | `staff_swap_exercise` (prévia com `dry_run`) |
| Ajuste em lote | séries e reps para mais ou para menos, ver a prévia e aplicar | `staff_adjust_volume` |
| Fichas | criar, editar e apagar fichas sugeridas | leitura de `gym_presets`; `staff_upsert_preset`, `staff_delete_preset` |
| Equipe (só admin) | convidar e tirar instrutores, ver convites pendentes | `staff_list`, `staff_invite`, `staff_revoke_invite`, `staff_remove` |
| Histórico (só admin) | quem mudou o quê | leitura de `prescription_log` |

Regras que o front precisa respeitar:
- O lote sempre mostra a prévia antes e aplica com a mesma lista de alunos que mostrou.
- Erro `P0409` no editor do dia quer dizer "o aluno mudou o dia enquanto você editava": recarregar.

## Ordem sugerida

1. Esqueleto: login, escolha de academia e "Sem acesso".
2. Lista de alunos e tela do aluno, só leitura.
3. Editor de um dia.
4. Lotes (troca e ajuste).
5. Fichas e equipe.
6. Publicar num domínio próprio. Isso também destrava publicar a tela de consentimento do Google, hoje limitada a 100 e-mails de teste.

Ao fim, ligar a flag `staff_panel` da academia, que mostra o aviso de privacidade no app.

## Em aberto, para o plano do front

- **Stack:** Vite puro ou um framework (Next, Remix)? E qual biblioteca de componentes: própria ou pronta (shadcn, Mantine)?
- **Domínio:** um só para todas as academias (`painel.voluma…`), ou um por academia?
- **Cargas:** o instrutor vai querer ver a carga dos alunos? Hoje o backend não expõe isso (decisão do plano 18). Seria uma RPC agregada nova.
- **Celular:** o painel precisa funcionar no celular do instrutor, ou é só desktop?
- **Biblioteca de movimentos:** dá para reaproveitar as artes do app (`src/movements/art`) no seletor de exercício?
