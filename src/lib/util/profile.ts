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

export function profileImageExtension(file: File) {
  const ext = PROFILE_IMAGE_TYPES[file.type as keyof typeof PROFILE_IMAGE_TYPES];
  if (!ext || !file.size || file.size > 5 * 1024 * 1024) {
    throw new Error('Выбери JPG, PNG, WEBP или GIF до 5 МБ');
  }
  return ext;
}
