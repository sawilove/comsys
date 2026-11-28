// Системные уведомления, пока приложение открыто (вкладка в фоне или свёрнуто).
// Пуши при закрытом приложении (Web Push / FCM) приходят на следующем этапе.
const soundKey = 'comsys-notification-sound';
let context: AudioContext | undefined;
let lastSound = 0;

export function isDesktopSoundAvailable() {
  return typeof AudioContext !== 'undefined' && matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function soundEnabled() {
  try { return localStorage.getItem(soundKey) !== 'off'; } catch { return true; }
}

export function setSoundEnabled(enabled: boolean) {
  try { localStorage.setItem(soundKey, enabled ? 'on' : 'off'); } catch {}
}

export function unlockNotificationSound() {
  if (!isDesktopSoundAvailable() || !soundEnabled()) return;
  try {
    context ??= new AudioContext();
    if (context.state === 'suspended') void context.resume().catch(() => {});
  } catch {}
}

export async function playNotificationSound(preview = false) {
  if (!isDesktopSoundAvailable() || !soundEnabled() || (!preview && Date.now() - lastSound < 900)) return;
  if (preview) unlockNotificationSound();
  if (!context) return;
  try {
    if (preview && context.state === 'suspended') await context.resume();
    if (context.state !== 'running') return;
    lastSound = Date.now();
    const start = context.currentTime + .01;
    for (const [i, hz] of [523.25, 659.25].entries()) {
      const tone = context.createOscillator();
      const volume = context.createGain();
      const at = start + i * .078;
      tone.frequency.value = hz;
      tone.type = 'sine';
      volume.gain.setValueAtTime(.001, at);
      volume.gain.linearRampToValueAtTime(i ? .042 : .055, at + .023);
      volume.gain.exponentialRampToValueAtTime(.001, at + .20);
      tone.connect(volume).connect(context.destination);
      tone.onended = () => { tone.disconnect(); volume.disconnect(); };
      tone.start(at);
      tone.stop(at + .21);
    }
  } catch {}
}
export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export async function askNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission !== 'default') return Notification.permission;
  return Notification.requestPermission();
}

export function notify(title: string, body: string, onClick?: () => void) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  if (document.visibilityState === 'visible' && document.hasFocus()) return;
  try {
    const n = new Notification(title, { body: body.slice(0, 140), icon: import.meta.env.BASE_URL + 'icon-192.png', tag: 'comsys',
      silent: isDesktopSoundAvailable() && (!soundEnabled() || context?.state === 'running') });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
  } catch {
    /* на iOS вне PWA конструктор недоступен */
  }
}
