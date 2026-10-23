# Painel da academia

O site em que a equipe da academia (admin e instrutores) acompanha os alunos e
monta os treinos deles. É uma casca em volta das RPCs `staff_*` do Supabase:
o painel não tem servidor próprio e não grava em tabela nenhuma diretamente.
Toda escrita passa por uma função que confere se a pessoa é equipe daquela
academia.

- **Desenho do backend:** [`plans/18-painel-admin.md`](../plans/18-painel-admin.md)
- **O painel em si:** [`plans/19-painel-web.md`](../plans/19-painel-web.md)
- **Planos:** [`plans/20-planos.md`](../plans/20-planos.md)

## Rodar

```sh
cd web
npm install
npm run dev        # http://localhost:5173
npm test           # Vitest: regras puras e rotas
npm run typecheck
npm run build      # typecheck + build estático em dist/
```

O painel lê o `.env` da raiz do repositório, com a mesma URL e a mesma chave
publicável do app (`EXPO_PUBLIC_SUPABASE_*`).

### Modo demo

`http://localhost:5173/?demo` abre o painel com dados de mentira em memória,
sem login e sem tocar no banco. Uma faixa no topo avisa que é demo, e
recarregar a página volta tudo ao início. Serve para experimentar os fluxos e
mostrar o painel para alguém.

São 10 alunos, três treinos (A peito e tríceps, B costas e bíceps, C pernas) e
dois planos ("Hipertrofia ABC" e "Iniciante AB"). Alguns alunos já estão em
plano, um tem uma exceção e outro tem treino próprio, para os conflitos
aparecerem na prévia. O backend falso fica em `src/demo/backend.ts` e imita as
RPCs no que as telas usam.

Os mesmos dados existem de verdade na academia `teste` do Supabase, para testar
com o app no celular: [`supabase/seeds/painel-teste.sql`](../supabase/seeds/painel-teste.sql)
cria e [`painel-teste-limpar.sql`](../supabase/seeds/painel-teste-limpar.sql)
apaga.

### Login

O login é com Google, pelo Supabase, igual ao app. Para o Google devolver a
pessoa ao painel, `http://localhost:5173/**` (e, depois, o domínio de produção)
precisa estar em **Authentication → URL Configuration → Redirect URLs** no
Supabase. Sem isso, o Supabase manda para a Site URL, que é a do app.

## Quem entra

| Quem | Como chega lá | O que pode |
|---|---|---|
| **Admin** | a equipe Voluma cria, pelo SQL (`service_role`) | tudo do instrutor; convidar e remover instrutores |
| **Instrutor** | o admin convida pelo e-mail Google | ver alunos, montar treinos e planos, mudar o treino de um aluno |
| **Aluno** | instalou o app da academia e entrou com a conta | aparece na lista; não entra no painel |

Ao entrar, a primeira chamada é `staff_claim_invites`. Ela transforma os
convites daquele e-mail em equipe e devolve as academias da pessoa:

- **nenhuma:** a tela "Sem acesso";
- **uma:** entra direto;
- **mais de uma:** escolhe qual quer ver.

O nome e a cor da academia vêm de `gyms/<slug>/config.json`, como no build do
app.

> Ainda não há tela de equipe: convidar e remover instrutores é pelo SQL, com
> `staff_invite` e `staff_remove`.

## As palavras do painel

| Palavra | O que é | No banco |
|---|---|---|
| **Treino** | os exercícios de um dia, com séries e reps. Ex.: "Treino A · Peito e tríceps" | `gym_presets` e `gym_preset_exercises` (no app, "ficha") |
| **Plano** | um programa da semana: cada dia aponta para um treino ou é descanso. Ex.: Hipertrofia ABC = A na segunda, B na quarta, C na sexta | `gym_plans` e `gym_plan_days` |
| **Aluno no plano** | o aluno tem pelo menos um dia da semana vindo daquele plano | `routines.plan_id` (não há tabela de membros) |
| **Exceção** | algo mudado só para um aluno, sem tirá-lo do plano: séries e reps próprias, exercício a mais, exercício tirado ou trocado | `routine_exercises.custom_targets`, linha sem `preset_exercise_id`, linha da ficha apagada |
| **Dia prescrito** | um dia montado pelo instrutor só para aquele aluno, fora de plano | `routines.prescribed_by` |
| **Editado pelo aluno** | o aluno mexeu no dia pelo app, e o dia saiu do plano ou da prescrição | `prescribed_at` preenchido e `prescribed_by` vazio |

A regra que amarra tudo: **séries e reps vêm da academia, a carga vem do
aluno.** O painel nunca vê nem muda carga, séries feitas ou peso corporal.

## Telas

### Alunos (`#/alunos`)

A lista de quem usa o app da academia, com quanto cada um treinou, o último
treino, quantos dias tem na semana, quantos estão prescritos e quantos o
aluno editou.

**Filtros:** nome ou @, exercício que o aluno tem na semana ("Tem no plano"),
período da frequência, tempo sem treinar e "só com dias prescritos". Eles vão
para o `staff_find_students`, que faz a conta no banco.

**Pôr vários alunos num plano:** é o caminho principal para atribuir.

1. Filtre, se quiser, e marque os alunos. A caixa no cabeçalho marca todos os
   da lista.
2. Aparece uma barra embaixo: "3 alunos marcados", a escolha do plano e
   **Pôr no plano**.
3. Abre a prévia (abaixo).

Clicar no nome abre a tela do aluno.

### Aluno (`#/aluno/<id>`)

Os sete dias da semana do aluno. Cada dia mostra de onde veio: "Plano
Hipertrofia ABC", "Ficha …", "Prescrito", "Editado pelo aluno" ou "Do aluno".
Exceções aparecem marcadas com `*`.

| Ação | Quando aparece | O que faz | RPC |
|---|---|---|---|
| **Personalizar** | dia que segue um plano ou ficha | muda só para este aluno; ele continua no plano e recebe as outras mudanças | `staff_customize_day` |
| **Editar** | dia fora de plano | substitui o dia, que fica prescrito | `staff_set_day` |
| **Montar dia** | dia de descanso | cria o dia, prescrito | `staff_set_day` |
| **Voltar ao plano** | dia de plano com exceções | refaz o dia a partir do treino e apaga as exceções | `staff_reset_day` |

### Planos (`#/planos`)

A lista dos planos: nome, a semana resumida (`Seg A · Qua B · Sex C`) e se o
plano está aberto para o aluno escolher no app ou só a equipe atribui. **Novo plano** abre o editor vazio
(`#/plano/novo`).

### Plano (`#/plano/<id>`)

De cima para baixo:

- **Nome**, com **Adicionar alunos**, **Salvar plano** e **Apagar plano** no
  topo.
- **Semana:** para cada dia, um treino ou descanso. "Aberto" deixa os alunos
  escolherem este plano sozinhos no app.
- **Alunos:** quem segue o plano e como está:
  - **Em dia:** segue tudo;
  - **Com exceções em N dias:** o instrutor personalizou;
  - **Parcial: 2 de 3 dias:** o aluno editou um dia pelo app, e só aquele dia
    saiu do plano.

  Cada linha tem **Tirar do plano**. Os treinos ficam com o aluno, como dias
  prescritos.
- **Treinos:** os treinos da academia, para criar ou editar. Editar um treino
  muda o dia de todo mundo que segue o plano, menos nas exceções de cada aluno.

Salvar o plano depois de mudar a semana propaga para os alunos:
- **dia trocado:** o treino novo entra em quem ainda segue aquele dia;
- **dia novo:** entra só em quem tem o dia livre;
- **dia tirado:** fica com os alunos como dia prescrito.

A mensagem depois de salvar diz quantos dias mudaram e quantos ficaram como
estavam. Com a semana alterada e não salva, "Adicionar alunos" fica desligado:
a prévia precisa ver o plano que vai ser aplicado.

### Adicionar alunos e a prévia

"Adicionar alunos" (na tela do plano) e "Pôr no plano" (na tela Alunos) abrem
o mesmo painel lateral (`src/components/AssignPanel.tsx`).

1. **Escolher:** vindo da tela do plano, a lista já aparece carregada. Os
   filtros (nome ou @, exercício, tempo sem treinar e "só quem não está em
   nenhum plano") se aplicam enquanto você digita, e "Marcar os N da lista"
   marca todos os filtrados. Vindo da tela Alunos, este passo é pulado.
2. **Prévia:** uma linha por aluno, com cada dia do plano e o que ele tem hoje
   nesse dia:

   | O que o aluno tem no dia | O que acontece |
   |---|---|
   | Dia livre | o plano entra |
   | Já está no plano | nada muda |
   | Treino do aluno, Treino prescrito, Ficha ou Outro plano | **conflito**: você marca se o plano substitui |

   "Substituir todos" e "Pular todos" resolvem de uma vez.
3. **Aplicar em N dias:** manda exatamente a lista da prévia
   (`staff_assign_plan`, com os pares aluno e dia marcados em `replace`). Os
   alunos vão em blocos de 200. O resultado diz quantos dias entraram e quantos
   ficaram como estavam.

Os alunos recebem a mudança na próxima vez que o app sincronizar.

## Erros

O painel traduz os dois erros que o banco devolve de propósito
(`src/lib/data.ts`, `friendly`):

| Código | Quando | Mensagem |
|---|---|---|
| `P0409` | o aluno mudou o dia pelo app enquanto o instrutor editava | "O aluno mudou este dia enquanto você editava. Recarregue e tente de novo." |
| `42501` | a conta não é equipe desta academia | "Sua conta não tem permissão para isso nesta academia." |

## Código

```
src/
  main.tsx              liga o modo demo (?demo) antes de subir o App
  App.tsx               sessão, academias, barra de cima e as rotas
  screens/              uma tela por rota, mais Login, GymPicker e Message
  components/
    AssignPanel.tsx     escolher alunos, prévia e aplicar um plano
    ExerciseList.tsx    editor de exercícios (treino e dia do aluno)
  lib/
    data.ts             toda leitura e toda chamada de RPC
    plans.ts            regras puras dos planos: resumo da semana, status, replace
    students.ts         regras puras dos alunos: nome, origem do dia, busca
    route.ts            rotas no hash
    session.ts          login e logout com Google
    gyms.ts             nome e cor de gyms/<slug>/config.json
    movements.ts        a biblioteca de movimentos do app, para o seletor
  demo/backend.ts       o Supabase de mentira do modo demo
  styles.css            tokens do Design/design.md e todo o CSS
```

Convenções:

- **Telas não chamam o Supabase.** Elas usam as funções de `lib/data.ts`, que
  devolvem tipos prontos e erros já traduzidos.
- **Regra pura em `lib/plans.ts` e `lib/students.ts`**, com teste no
  `__tests__` ao lado. As telas só montam a interface.
- **Rotas no hash** (`#/alunos`): funciona em qualquer hospedagem estática, sem
  configurar reescrita de URL.
- **Do app, só módulos puros**: `@domain/week`, `@domain/types` e os dados de
  `src/movements` (aliases no `vite.config.ts`, tipos em `src/shims.d.ts`). O
  `web/` fica fora do TypeScript, do Jest e do lint da raiz, porque usa DOM e
  não React Native.
- **Visual:** o do `Design/design.md`, adaptado para tela grande. CSS próprio,
  sem biblioteca de UI, e um só botão de destaque por tela.

## O que falta

- Testar o login com Google de verdade no painel. Os fluxos foram testados no
  modo demo e com o Supabase simulado.
- Lotes de troca de exercício e de ajuste de volume (`staff_swap_exercise` e
  `staff_adjust_volume`, que já existem no banco).
- Telas de equipe e de histórico, só para o admin.
- Publicar num domínio próprio e ligar a flag `staff_panel` da academia, que
  mostra o aviso de privacidade no app.
