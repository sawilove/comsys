// Демо-режим: весь «сервер» живёт в браузере (localStorage), чтобы потрогать интерфейс
// без регистрации в Supabase. Включается сам, если в .env нет ключей Supabase.
import { ulid } from 'ulid';
import {
  ApiError,
  type Attachment,
  type Backend,
  type Channel,
  type Group,
  type Member,
  type Message,
  type NewMessage,
  type Profile,
  type RealtimeHandlers,
} from './types';

interface DB {
  me: string | null;
  profiles: Profile[];
  groups: Group[];
  channels: Channel[];
  members: Member[];
  messages: Message[];
}

const KEY = 'comsys-demo-db';
const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function profile(username: string, display_name: string, accent: string): Profile {
  return { id: uuid(), username, display_name, avatar_url: null, profile: { v: 1, accent }, status: 'online', is_admin: false };
}

function seed(): DB {
  const anya = profile('anya', 'Аня', '#f472b6');
  const misha = profile('misha', 'Миша', '#60a5fa');
  const lesha = profile('lesha', 'Лёша', '#34d399');
  return { me: null, profiles: [anya, misha, lesha], groups: [], channels: [], members: [], messages: [] };
}

const BOT_LINES = [
  'Привет! Это демо, сервер живёт прямо в твоём браузере 🙂',
  'Голосовые тоже работают, попробуй кнопку микрофона',
  'Ага, видел',
  'Го вечером в голосовой? (появится на этапе звонков)',
  'Ахаха',
  'Сейчас гляну',
];

export class DemoBackend implements Backend {
  readonly kind = 'demo' as const;
  private db: DB;
  private handlers = new Set<RealtimeHandlers>();
  private blobs = new Map<string, Blob>();

  constructor() {
    let db: DB | null = null;
    try {
      db = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    } catch {
      /* пусто */
    }
    this.db = db ?? seed();
  }

  private save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(this.db));
    } catch {
      /* приватный режим */
    }
  }
  private me(): string {
    if (!this.db.me) throw new ApiError('unauthorized');
    return this.db.me;
  }
  private emitStructure() {
    queueMicrotask(() => this.handlers.forEach((h) => h.onStructureChanged()));
  }
  private emitMessage(m: Message) {
    queueMicrotask(() => this.handlers.forEach((h) => h.onMessage(m)));
  }
  private wait(ms = 120) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async currentUserId() {
    return this.db.me;
  }

  async signIn(username: string, _password: string) {
    await this.wait();
    const p = this.db.profiles.find((x) => x.username === username.trim().toLowerCase());
    if (!p || p.username === 'anya' || p.username === 'misha' || p.username === 'lesha') throw new ApiError('bad_credentials');
    this.db.me = p.id;
    this.save();
  }

  async redeemInvite(_code: string, username: string, displayName: string, _password: string) {
    await this.wait();
    const u = username.trim().toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(u)) throw new ApiError('bad_username');
    if (this.db.profiles.some((p) => p.username === u)) throw new ApiError('username_taken');
    const me = profile(u, displayName.trim() || u, '#a78bfa');
    me.is_admin = true;
    this.db.profiles.push(me);
    this.db.me = me.id;
    // Стартовая группа с ботами, чтобы было на что посмотреть.
    const others = this.db.profiles.filter((p) => p.id !== me.id).map((p) => p.id);
    const gid = this.makeGroup('Друзья', me.id, others);
    const ch = this.db.channels.find((c) => c.group_id === gid && c.kind === 'text')!;
    this.botSay(ch, others[0], 'Добро пожаловать в C-COMSYS! 👋', 400);
    this.save();
  }

  async signOut() {
    this.db.me = null;
    this.save();
  }

  async listProfiles() {
    return structuredClone(this.db.profiles);
  }

  async updateMyProfile(patch: Partial<Profile>) {
    const p = this.db.profiles.find((x) => x.id === this.me())!;
    Object.assign(p, patch);
    this.save();
  }

  async snapshot() {
    const me = this.me();
    const mine = new Set(this.db.members.filter((m) => m.user_id === me).map((m) => m.group_id));
    return structuredClone({
      groups: this.db.groups.filter((g) => mine.has(g.id)),
      channels: this.db.channels.filter((c) => mine.has(c.group_id)),
      members: this.db.members.filter((m) => mine.has(m.group_id)),
    });
  }

  private makeGroup(name: string | null, owner: string, members: string[], kind: 'group' | 'dm' = 'group'): string {
    const id = uuid();
    this.db.groups.push({ id, kind, name, icon_url: null, owner_id: kind === 'group' ? owner : null, created_at: now() });
    if (kind === 'group') {
      this.db.channels.push({ id: uuid(), group_id: id, kind: 'text', name: 'общий', position: 0 });
      this.db.channels.push({ id: uuid(), group_id: id, kind: 'voice', name: 'Голосовой', position: 100 });
    } else {
      this.db.channels.push({ id: uuid(), group_id: id, kind: 'text', name: 'чат', position: 0 });
    }
    for (const u of new Set([owner, ...members])) this.db.members.push({ group_id: id, user_id: u, nickname: null });
    return id;
  }

  async createGroup(name: string, memberIds: string[]) {
    await this.wait();
    if (!name.trim()) throw new ApiError('name_required');
    const id = this.makeGroup(name.trim(), this.me(), memberIds);
    this.save();
    this.emitStructure();
    return id;
  }

  async openDM(userId: string) {
    const me = this.me();
    const existing = this.db.groups.find(
      (g) =>
        g.kind === 'dm' &&
        this.db.members.some((m) => m.group_id === g.id && m.user_id === me) &&
        this.db.members.some((m) => m.group_id === g.id && m.user_id === userId),
    );
    if (existing) return existing.id;
    const id = this.makeGroup(null, me, [userId], 'dm');
    this.save();
    this.emitStructure();
    return id;
  }

  async addMembers(groupId: string, userIds: string[]) {
    for (const u of userIds) {
      if (!this.db.members.some((m) => m.group_id === groupId && m.user_id === u)) {
        this.db.members.push({ group_id: groupId, user_id: u, nickname: null });
      }
    }
    this.save();
    this.emitStructure();
  }

  async leaveGroup(groupId: string) {
    const me = this.me();
    this.db.members = this.db.members.filter((m) => !(m.group_id === groupId && m.user_id === me));
    this.save();
    this.emitStructure();
  }

  async renameGroup(groupId: string, name: string) {
    const g = this.db.groups.find((x) => x.id === groupId);
    if (g) g.name = name;
    this.save();
    this.emitStructure();
  }

  async createChannel(groupId: string, name: string, kind: 'text' | 'voice') {
    this.db.channels.push({ id: uuid(), group_id: groupId, kind, name, position: kind === 'voice' ? 100 : 10 });
    this.save();
    this.emitStructure();
  }

  async createInvite() {
    return 'DEMO-' + Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  private visible(m: Message) {
    const me = this.db.me;
    return this.db.members.some((x) => x.group_id === m.group_id && x.user_id === me);
  }

  async fetchSince(since: string | null, limit: number) {
    return structuredClone(
      this.db.messages.filter((m) => this.visible(m) && (!since || m.created_at >= since)).slice(0, limit),
    );
  }

  async fetchHistory(channelId: string, before: string | null, limit: number) {
    const all = this.db.messages.filter((m) => m.channel_id === channelId && (!before || m.created_at < before));
    return structuredClone(all.slice(-limit));
  }

  async sendMessage(n: NewMessage): Promise<Message> {
    await this.wait(80);
    const dup = this.db.messages.find((m) => m.id === n.id);
    if (dup) return structuredClone(dup);
    const ch = this.db.channels.find((c) => c.id === n.channel_id)!;
    const m: Message = {
      ...n,
      group_id: ch.group_id,
      author_id: this.me(),
      created_at: now(),
      edited_at: null,
      deleted_at: null,
    };
    this.db.messages.push(m);
    this.save();
    this.emitMessage(structuredClone(m));
    // Кто-нибудь из ботов иногда отвечает.
    const bots = this.db.members.filter((x) => x.group_id === ch.group_id && x.user_id !== m.author_id).map((x) => x.user_id);
    if (bots.length && Math.random() < 0.6) {
      const bot = bots[Math.floor(Math.random() * bots.length)];
      this.botSay(ch, bot, BOT_LINES[Math.floor(Math.random() * BOT_LINES.length)], 1200 + Math.random() * 1500);
    }
    return structuredClone(m);
  }

  private botSay(ch: Channel, author: string, body: string, delay: number) {
    setTimeout(() => {
      const m: Message = {
        id: ulid(),
        channel_id: ch.id,
        group_id: ch.group_id,
        author_id: author,
        kind: 'text',
        body,
        attachments: [],
        reply_to: null,
        created_at: now(),
        edited_at: null,
        deleted_at: null,
      };
      this.db.messages.push(m);
      this.save();
      this.emitMessage(structuredClone(m));
    }, delay);
  }

  async editMessage(id: string, body: string) {
    const m = this.db.messages.find((x) => x.id === id && x.author_id === this.me());
    if (!m) throw new ApiError('forbidden');
    m.body = body;
    m.edited_at = now();
    this.save();
    this.emitMessage(structuredClone(m));
  }

  async deleteMessage(id: string) {
    const m = this.db.messages.find((x) => x.id === id && x.author_id === this.me());
    if (!m) throw new ApiError('forbidden');
    m.body = '';
    m.attachments = [];
    m.deleted_at = now();
    this.save();
    this.emitMessage(structuredClone(m));
  }

  async uploadMedia(_g: string, _c: string, blob: Blob) {
    await this.wait(200);
    const key = uuid();
    this.blobs.set(key, blob);
    return { provider: 'demo' as const, key };
  }

  async mediaUrl(att: Attachment) {
    const b = this.blobs.get(att.key);
    if (!b) throw new ApiError('gone', 'В демо-режиме медиа живёт до перезагрузки страницы');
    return URL.createObjectURL(b);
  }

  subscribe(h: RealtimeHandlers) {
    this.handlers.add(h);
    queueMicrotask(() => h.onStatus(true));
    return () => this.handlers.delete(h);
  }
}
