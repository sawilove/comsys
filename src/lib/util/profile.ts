export const PROFILE_MEDIA_BUCKET = 'profile-media';
export const PROFILE_MEDIA_PREFIX = 'profile-media:';
export const PROFILE_IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
} as const;

export const profileBadges = {
  artist: '✦ Творчество',
  gamer: '◆ Игры',
  music: '♫ Музыка',
} as const;

export function profileAccent(value: unknown): string | undefined {
  return typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value : undefined;
}

export type ProfileImageKind = 'avatar' | 'banner';
export type ProfileCrop = { x: number; y: number; zoom: number };
export type GradientStop = { color: string; position: number };
export type ProfileGradient = { angle: number; stops: GradientStop[] };

export const defaultCrop: ProfileCrop = { x: 50, y: 50, zoom: 1 };
export const maxCropZoom = 4;

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function bounded(value: unknown, min: number, max: number, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? clamp(value, min, max) : fallback;
}

export function profileCrop(value: unknown): ProfileCrop {
  const crop = value && typeof value === 'object' ? value as Partial<ProfileCrop> : defaultCrop;
  return {
    x: bounded(crop.x, 0, 100, defaultCrop.x),
    y: bounded(crop.y, 0, 100, defaultCrop.y),
    zoom: bounded(crop.zoom, 1, maxCropZoom, defaultCrop.zoom),
  };
}

export function profileGradient(value: unknown): ProfileGradient | null {
  if (!value || typeof value !== 'object') return null;
  const gradient = value as Partial<ProfileGradient>;
  if (!Array.isArray(gradient.stops) || gradient.stops.length < 2 || gradient.stops.length > 4) return null;
  const stops: GradientStop[] = [];
  for (const stop of gradient.stops) {
    const color = profileAccent(stop?.color);
    if (!color) return null;
    stops.push({ color, position: bounded(stop.position, 0, 100, 0) });
  }
  return { angle: bounded(gradient.angle, 0, 360, 135), stops };
}

export function gradientBackground(gradient: ProfileGradient) {
  const stops = [...gradient.stops].sort((a, b) => a.position - b.position);
  return `linear-gradient(${gradient.angle}deg, ${stops.map(({ color, position }) => `${color} ${position}%`).join(', ')})`;
}

export function profileImageExtension(file: File) {
  const ext = PROFILE_IMAGE_TYPES[file.type as keyof typeof PROFILE_IMAGE_TYPES];
  if (!ext || !file.size || file.size > 5 * 1024 * 1024) {
    throw new Error('Выбери JPG, PNG, WEBP или GIF до 5 МБ');
  }
  return ext;
}
