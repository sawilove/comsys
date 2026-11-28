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

export const themeColors = {
  '--accent': 'Акцент',
  '--bg': 'Фон',
  '--bg-elev': 'Панели',
  '--bg-sunken': 'Поля ввода',
  '--text': 'Текст',
  '--bubble-me': 'Свои сообщения',
  '--bubble-me-text': 'Текст своих сообщений',
  '--bubble-other': 'Чужие сообщения',
  '--bubble-other-text': 'Текст чужих сообщений',
  '--chat-bg': 'Фон чата',
} as const;

type ColorKey = keyof typeof themeColors;
export interface ThemePreset {
  id: string;
  name: string;
  baseId: string;
  colors: Partial<Record<ColorKey, string>>;
  bubbleRadius: number;
  fontSize: number;
}

const KEY = 'comsys-theme';
const PRESETS_KEY = 'comsys-theme-presets';
const hexColor = /^#[\da-f]{6}$/i;

export function parsePreset(value: unknown): ThemePreset {
  if (typeof value !== 'object' || !value) throw new Error('Некорректный пресет');
  const preset = value as Partial<ThemePreset>;
  if (typeof preset.name !== 'string' || !preset.name.trim() || preset.name.length > 48 ||
      !THEMES.some((theme) => theme.id === preset.baseId) ||
      !preset.colors || typeof preset.colors !== 'object' || Array.isArray(preset.colors) ||
      typeof preset.bubbleRadius !== 'number' || !Number.isInteger(preset.bubbleRadius) ||
      preset.bubbleRadius < 4 || preset.bubbleRadius > 28 ||
      typeof preset.fontSize !== 'number' || !Number.isInteger(preset.fontSize) ||
      preset.fontSize < 13 || preset.fontSize > 20) throw new Error('Некорректный пресет');
  const colors: ThemePreset['colors'] = {};
  for (const key of Object.keys(themeColors) as ColorKey[]) {
    const color = preset.colors[key];
    if (color === undefined) continue;
    if (typeof color !== 'string' || !hexColor.test(color)) throw new Error('Некорректный цвет в пресете');
    colors[key] = color;
  }
  return {
    id: typeof preset.id === 'string' && /^custom-[\da-f-]{36}$/.test(preset.id) ? preset.id : newPresetId(),
    name: preset.name.trim(), baseId: preset.baseId!, colors,
    bubbleRadius: preset.bubbleRadius, fontSize: preset.fontSize,
  };
}

export function newPresetId() {
  return `custom-${crypto.randomUUID()}`;
}

export function readPresets(): ThemePreset[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(PRESETS_KEY) ?? '[]');
    return Array.isArray(saved) ? saved.flatMap((item) => {
      try { return [parsePreset(item)]; } catch { return []; }
    }) : [];
  } catch {
    return [];
  }
}

export function writePresets(presets: ThemePreset[]) {
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

export function currentThemeId(): string {
  try {
    return localStorage.getItem(KEY) || 'night';
  } catch {
    return 'night';
  }
}

export function applyTheme(id: string) {
  const preset = id.startsWith('custom-') ? readPresets().find((item) => item.id === id) : undefined;
  const theme = preset ? presetTheme(preset) : THEMES.find((x) => x.id === id) ?? THEMES[0];
  renderTheme(theme);
  try {
    localStorage.setItem(KEY, theme.id);
  } catch {
    /* ignore */
  }
}

export function presetTheme(preset: ThemePreset): Theme {
  const baseTheme = THEMES.find((theme) => theme.id === preset.baseId) ?? THEMES[0];
  const tokens: Record<string, string> = { ...baseTheme.tokens };
  for (const [key, color] of Object.entries(preset.colors)) {
    if (color !== undefined) tokens[key] = color;
  }
  tokens['--bubble-radius'] = `${preset.bubbleRadius}px`;
  tokens['--ui-font-size'] = `${preset.fontSize}px`;
  if (preset.colors['--accent']) {
    tokens['--accent-soft'] = `color-mix(in srgb, ${tokens['--accent']} 18%, transparent)`;
    if (!preset.colors['--bubble-me']) tokens['--bubble-me'] = tokens['--accent'];
  }
  if (preset.colors['--bg'] && !preset.colors['--chat-bg']) tokens['--chat-bg'] = tokens['--bg'];
  return { ...baseTheme, id: preset.id, name: preset.name, tokens };
}

export function renderTheme(t: Theme) {
  const root = document.documentElement;
  root.style.removeProperty('--ui-font-size');
  for (const [k, v] of Object.entries(t.tokens)) root.style.setProperty(k, v);
  root.dataset.theme = t.id;
  root.style.colorScheme = t.dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.tokens['--bg']);
}
