import { api, type UserPresence } from '../api';

const heartbeatMs = 35_000;
const offlineMs = 100_000;
const idleMs = 180_000;
const relative = new Intl.RelativeTimeFormat('ru', { numeric: 'always' });

class PresenceState {
  private rows = $state<Record<string, UserPresence>>({});
  private now = $state(Date.now());
  private generation = 0;

  receive(row: UserPresence) {
    const previous = this.rows[row.user_id];
    if (!previous || Date.parse(previous.last_seen_at) <= Date.parse(row.last_seen_at)) this.rows[row.user_id] = row;
  }

  async refresh() {
    if (api.kind === 'demo') return;
    const generation = this.generation;
    try {
      const rows = await api.listPresence();
      if (generation === this.generation) for (const row of rows) this.receive(row);
    } catch {}
  }

  status(userId: string): { kind: 'online' | 'idle' | 'offline'; label: string } {
    const row = this.rows[userId];
    if (!row) return { kind: 'offline', label: 'Не в сети' };
    const since = Math.max(0, this.now - Date.parse(row.last_seen_at));
    if (since < offlineMs) {
      return this.now - Date.parse(row.last_active_at) >= idleMs
        ? { kind: 'idle', label: 'Отошёл' }
        : { kind: 'online', label: 'В сети' };
    }
    const minutes = Math.floor(since / 60_000);
    const text = minutes < 60 ? relative.format(-minutes, 'minute')
      : minutes < 1440 ? relative.format(-Math.floor(minutes / 60), 'hour')
      : relative.format(-Math.floor(minutes / 1440), 'day');
    return { kind: 'offline', label: `Был(а) в сети ${text}` };
  }

  track() {
    let lastActive = Date.now();
    let lastAttempt = 0;
    let sending = false;
    const ping = async (force = false) => {
      const now = Date.now();
      this.now = now;
      if (api.kind === 'demo' || sending || !navigator.onLine || (!force && now - lastAttempt < heartbeatMs)) return;
      lastAttempt = now;
      sending = true;
      try { await api.touchPresence(Math.floor((now - lastActive) / 1000)); } catch {}
      finally { sending = false; }
    };
    const activity = () => {
      if (document.visibilityState !== 'visible') return;
      const wasIdle = Date.now() - lastActive >= idleMs;
      lastActive = Date.now();
      if (wasIdle || lastActive - lastAttempt >= heartbeatMs) void ping(wasIdle);
    };
    const reconnect = () => { void ping(true); void this.refresh(); };
    const visibility = () => { if (document.visibilityState === 'visible') { activity(); reconnect(); } };
    const events = ['pointerdown', 'keydown', 'wheel', 'touchstart', 'pointermove'] as const;
    for (const event of events) window.addEventListener(event, activity, { passive: true });
    window.addEventListener('focus', activity);
    window.addEventListener('online', reconnect);
    document.addEventListener('visibilitychange', visibility);
    const timer = window.setInterval(() => { void ping(); }, 10_000);
    reconnect();
    return () => {
      window.clearInterval(timer);
      for (const event of events) window.removeEventListener(event, activity);
      window.removeEventListener('focus', activity);
      window.removeEventListener('online', reconnect);
      document.removeEventListener('visibilitychange', visibility);
      this.generation++;
      this.rows = {};
    };
  }
}

export const presence = new PresenceState();
