# Academias

Cada pasta aqui é um app na loja: `padrao` é o Voluma, as outras são as
academias. Todas usam o mesmo código e o mesmo Supabase. O slug (o nome da
pasta) é o **mundo** daquele app. Ver
[`plans/16-multi-academia.md`](../plans/16-multi-academia.md).

## O que tem em cada pasta

| Arquivo | O que é |
|---|---|
| `config.json` | `{ "name": "...", "accent": "#RRGGBB" }` — o nome na tela inicial e a cor de destaque |
| `icon.png` | ícone do app |
| `android-icon-foreground.png` | frente do ícone adaptativo do Android |
| `android-icon-monochrome.png` | ícone monocromático do Android |
| `splash-icon.png` | imagem da tela de abertura |

O `app.config.ts` lê a pasta pelo `APP_VARIANT` e monta o package
(`com.luisf.voluma.<slug>`), o scheme do login (`voluma-<slug>`), os ícones e o
`extra` com o mundo e o accent. Sem `APP_VARIANT`, é o `padrao`.

## Criar uma academia

1. **Slug:** só letras minúsculas e números, começando por letra
   (`smartfit2`, não `smart-fit`). Ele vira package Android, que não aceita
   hífen, e scheme, que não aceita underscore.
2. **Pasta** `gyms/<slug>/` com os cinco arquivos acima. O accent precisa de
   contraste de pelo menos 4,5:1 com o preto. O `npm test` reprova se faltar.
3. **Banco:** `insert into public.gyms (id, name) values ('<slug>', '<Nome>');`
   Sem essa linha, o sync do app é recusado pela chave estrangeira.
4. **Login:** `voluma-<slug>://**` nas Redirect URLs do Supabase Auth.
5. **`eas.json`:** um perfil com `"env": { "APP_VARIANT": "<slug>" }` e
   `"channel": "<slug>"` (ver o perfil `teste`).

## Rodar uma academia no celular (USB)

O `android/` é gerado a partir da config, então trocar de academia exige
gerar de novo:

```sh
APP_VARIANT=<slug> npx expo prebuild --clean --platform android
APP_VARIANT=<slug> npx expo run:android
```

O `--clean` apaga o `android/local.properties` (caminho do Android SDK), que
precisa ser recriado à mão. Ver "O que travou no caminho" em
[`plans/README.md`](../plans/README.md).

## `teste`

Uma academia de mentira, para provar o mecanismo de ponta a ponta: o mesmo
ícone do Voluma, accent ciano. Ela existe no banco e no `eas.json`, mas não vai
para a loja.
