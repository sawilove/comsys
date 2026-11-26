// Локальная копия на устройстве (IndexedDB): история открывается мгновенно и без сети,
// а неотправленное лежит в очереди и уходит, как только появится связь.
import type { Message, NetworkSnapshot, Profile } from '../api';

export interface OutboxItem {
  message: Message; // локальная версия (author_id = я, created_at = время клиента)
  blob?: Blob; // голосовое, ещё не залитое
  mime?: string;
  tries: number;
}

const DB_NAME = 'comsys';
const VERSION = 1;

let dbp: Promise<IDBDatabase | null> | null = null;

function open(): Promise<IDBDatabase | null> {
  if (dbp) return dbp;
  dbp = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        const ms = db.createObjectStore('messages', { keyPath: 'id' });
        ms.createIndex('channel', ['channel_id', 'created_at']);
        db.createObjectStore('kv');
        db.createObjectStore('outbox', { keyPath: 'message.id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null); // без IndexedDB просто работаем без кэша
    }
  });
  return dbp;
}

function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
  return open().then(
    (db) =>
      new Promise((resolve) => {
        if (!db) return resolve(undefined);
        try {
          const t = db.transaction(store, mode);
          const r = fn(t.objectStore(store));
          t.oncomplete = () => resolve(r ? r.result : undefined);
          t.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

export const cache = {
  async putMessages(list: Message[]) {
    if (!list.length) return;
    await tx('messages', 'readwrite', (s) => {
      for (const m of list) s.put(m);
    });
  },
  async channelMessages(channelId: string, limit = 200): Promise<Message[]> {
    const db = await open();
    if (!db) return [];
    return new Promise((resolve) => {
      const out: Message[] = [];
      const range = IDBKeyRange.bound([channelId, ''], [channelId, '￿']);
      const req = db.transaction('messages').objectStore('messages').index('channel').openCursor(range, 'prev');
      req.onsuccess = () => {
        const c = req.result;
        if (c && out.length < limit) {
          out.push(c.value);
          c.continue();
        } else resolve(out.reverse());
      };
      req.onerror = () => resolve(out.reverse());
    });
  },
  /** Сколько сообщений в канале новее `after` (для счётчика непрочитанного). */
  async countAfter(channelId: string, after: string, exceptAuthor: string): Promise<number> {
    const db = await open();
    if (!db) return 0;
    return new Promise((resolve) => {
      let n = 0;
      const range = IDBKeyRange.bound([channelId, after], [channelId, '\uffff'], true, false);
      const req = db.transaction('messages').objectStore('messages').index('channel').openCursor(range);
      req.onsuccess = () => {
        const c = req.result;
        if (!c) return resolve(n);
        const m = c.value as Message;
        if (m.author_id !== exceptAuthor && !m.deleted_at) n++;
        if (n >= 99) return resolve(n);
        c.continue();
      };
      req.onerror = () => resolve(n);
    });
  },
  async get<T>(key: string): Promise<T | undefined> {
    return tx<T>('kv', 'readonly', (s) => s.get(key));
  },
  async set(key: string, value: unknown) {
    await tx('kv', 'readwrite', (s) => s.put(value, key));
  },
  async outbox(): Promise<OutboxItem[]> {
    return (await tx<OutboxItem[]>('outbox', 'readonly', (s) => s.getAll())) ?? [];
  },
  async putOutbox(item: OutboxItem) {
    await tx('outbox', 'readwrite', (s) => s.put(item));
  },
  async removeOutbox(id: string) {
    await tx('outbox', 'readwrite', (s) => s.delete(id));
  },
  async clear() {
    for (const s of ['messages', 'kv', 'outbox']) await tx(s, 'readwrite', (st) => st.clear());
  },
};

export type CachedSnapshot = NetworkSnapshot & { profiles: Profile[] };
