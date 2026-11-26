// Системные уведомления, пока приложение открыто (вкладка в фоне или свёрнуто).
// Пуши при закрытом приложении (Web Push / FCM) приходят на следующем этапе.
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
    const n = new Notification(title, { body: body.slice(0, 140), icon: import.meta.env.BASE_URL + 'icon-192.png', tag: 'comsys' });
    n.onclick = () => {
      window.focus();
      onClick?.();
      n.close();
    };
  } catch {
    /* на iOS вне PWA конструктор недоступен */
  }
}
