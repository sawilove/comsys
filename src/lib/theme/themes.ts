// Тема = набор дизайн-токенов (CSS-переменных). Небольшой JSON, который потом можно
// будет кинуть другу в чат и применить одной кнопкой (этап кастомизации).

export interface Theme {
  id: string;
  name: string;
  dark: boolean;
  tokens: Record<string, string>;
}

const base = {
  '--radius': '14px',
  '--bubble-radius': '18px',
  '--font': "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  '--density': '1',
};

function dark(id: string, name: string, accent: string, bg: string, elev: string, sunken: string, extra: Record<string, string> = {}): Theme {
  return {
    id,
    name,
    dark: true,
    tokens: {
      ...base,
      '--bg': bg,
      '--bg-elev': elev,
      '--bg-sunken': sunken,
      '--bg-hover': 'rgba(255,255,255,0.06)',
      '--bg-active': 'rgba(255,255,255,0.10)',
      '--text': '#ececf1',
      '--text-muted': '#9a9bab',
      '--text-faint': '#6b6c7b',
      '--border': 'rgba(255,255,255,0.08)',
      '--accent': accent,
      '--accent-text': '#ffffff',
      '--accent-soft': `color-mix(in srgb, ${accent} 18%, transparent)`,
      '--bubble-me': accent,
      '--bubble-me-text': '#ffffff',
      '--bubble-other': elev,
      '--bubble-other-text': '#ececf1',
      '--danger': '#f2555a',
      '--success': '#3ecf8e',
      '--shadow': '0 8px 30px rgba(0,0,0,0.45)',
      '--chat-bg': `radial-gradient(1200px 600px at 100% 0%, color-mix(in srgb, ${accent} 10%, transparent), transparent 60%), ${bg}`,
      ...extra,
    },
  };
}

export const THEMES: Theme[] = [
  dark('night', 'Ночь', '#7c5cff', '#121218', '#1c1c25', '#0c0c11'),
  {
    id: 'day',
    name: 'День',
    dark: false,
    tokens: {
      ...base,
      '--bg': '#f6f6fa',
      '--bg-elev': '#ffffff',
      '--bg-sunken': '#ebebf2',
      '--bg-hover': 'rgba(0,0,0,0.04)',
      '--bg-active': 'rgba(0,0,0,0.07)',
      '--text': '#17171c',
      '--text-muted': '#5f6072',
      '--text-faint': '#9091a0',
      '--border': 'rgba(0,0,0,0.08)',
      '--accent': '#6a4cff',
      '--accent-text': '#ffffff',
      '--accent-soft': 'rgba(106,76,255,0.12)',
      '--bubble-me': '#6a4cff',
      '--bubble-me-text': '#ffffff',
      '--bubble-other': '#ffffff',
      '--bubble-other-text': '#17171c',
      '--danger': '#e5484d',
      '--success': '#20a86b',
      '--shadow': '0 8px 30px rgba(20,20,40,0.12)',
      '--chat-bg': 'radial-gradient(1000px 500px at 100% 0%, rgba(106,76,255,0.07), transparent 60%), #f6f6fa',
    },
  },
  dark('amoled', 'AMOLED', '#8b7bff', '#000000', '#111114', '#000000', { '--border': 'rgba(255,255,255,0.10)', '--chat-bg': '#000' }),
  dark('ocean', 'Океан', '#22b8cf', '#0d1620', '#14212e', '#09111a'),
  dark('sakura', 'Сакура', '#ec6fa5', '#1a1217', '#251a21', '#120c10'),
  dark('forest', 'Лес', '#3ecf8e', '#0f1713', '#17221c', '#0a100d'),
];

const KEY = 'comsys-theme';

export function currentThemeId(): string {
  try {
    return localStorage.getItem(KEY) || 'night';
  } catch {
    return 'night';
  }
}

export function applyTheme(id: string) {
  const t = THEMES.find((x) => x.id === id) ?? THEMES[0];
  const root = document.documentElement;
  for (const [k, v] of Object.entries(t.tokens)) root.style.setProperty(k, v);
  root.dataset.theme = t.id;
  root.style.colorScheme = t.dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.tokens['--bg']);
  try {
    localStorage.setItem(KEY, t.id);
  } catch {
    /* ignore */
  }
}
