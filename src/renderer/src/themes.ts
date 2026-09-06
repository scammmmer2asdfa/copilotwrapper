export type ThemeId =
  | 'graphite'
  | 'paper'
  | 'github-dark'
  | 'github-dark-dimmed'
  | 'github-light'
  | 'dark-plus';

export const THEMES: { id: ThemeId; label: string }[] = [
  { id: 'graphite', label: 'Graphite' },
  { id: 'paper', label: 'Paper' },
  { id: 'github-dark', label: 'GitHub Dark' },
  { id: 'github-dark-dimmed', label: 'GitHub Dark Dimmed' },
  { id: 'github-light', label: 'GitHub Light' },
  { id: 'dark-plus', label: 'Dark+' }
];
