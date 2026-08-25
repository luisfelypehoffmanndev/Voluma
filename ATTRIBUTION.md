# Atribuição

## Ilustrações e catálogo de movimentos

As figuras dos exercícios e os metadados da biblioteca de movimentos vêm do
projeto **[workout-guide](https://github.com/bryllim/workout-guide)**, de
**[Bryl Lim](https://bryllim.com)**.

- **Arte** (`src/movements/art/*.ts`) — licenciada sob
  **[CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)**.
  As poses originais derivam do projeto
  **[Everkinetic](https://github.com/everkinetic/data)**, também sob CC BY-SA 4.0.
- **Metadados** (`src/movements/data.ts`) — músculo primário, equipamento e tipo
  de exercício, do mesmo projeto, sob licença MIT.

### O que foi alterado

Os arquivos em `src/movements/art/` são obra derivada. A partir de cada SVG do
workout-guide (um único `<path fill="#fff" fill-rule="evenodd">` num `viewBox`
de 512 × 512):

1. extraído apenas o atributo `d` do path;
2. arredondadas todas as coordenadas para 1 casa decimal;
3. gravado como string em um módulo TypeScript.

A cor deixa de estar no arquivo e passa a vir do tema do app em tempo de
renderização (`src/ui/MovementFigure.tsx`).

O processo está inteiro em `scripts/vendor-movement-art.mjs`, fixado no commit
`ba0b709cb20430361b2cb33aaadd20998164a916` do workout-guide.

### Share-alike

Por serem obra derivada de material CC BY-SA 4.0, os arquivos de
`src/movements/art/` permanecem sob **CC BY-SA 4.0**. Redistribuir o app, ou
essas figuras, exige manter esta atribuição e a mesma licença para a arte.

Os nomes em português (`src/movements/names.pt.ts`) e a taxonomia
(`src/movements/taxonomy.ts`) são deste projeto.
