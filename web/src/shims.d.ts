// Tipos dos modulos de movimentos do app que o painel usa (ver vite.config.ts).
// Declarados aqui para o TypeScript do painel nao seguir os imports de tipo
// deles, que chegam no codigo React Native.
declare module '@movements/data' {
  export const MOVEMENT_DATA: readonly (readonly [string, string, string, string])[];
}

declare module '@movements/names' {
  export const NAMES_PT: Readonly<Record<string, string>>;
}

declare module '@movements/taxonomy' {
  export function kindFor(equipment: string, type: string): 'strength' | 'run';
  export function groupFor(muscle: string, equipment: string, type: string): string;
}
