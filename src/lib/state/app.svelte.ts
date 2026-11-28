// Состояние приложения и синхронизация. Интерфейс читает только отсюда.
//
// Путь сообщения (как в документе архитектуры):
// 1) клиент даёт ID (ULID), кладёт в очередь (IndexedDB) и сразу показывает;
// 2) голосовое заливается в хранилище; 3) строка пишется в messages (повтор не дублирует);
// 4) Realtime рассылает тем, кто в сети; 5) вернувшись в сеть, клиент забирает всё после курсора.
import { ulid } from 'ulid';
import { api, ApiError, type Attachment, type Channel, type Group, type Member, type Message, type Profile, type ReadReceipt } from '../api';
import { cache, type OutboxItem } from './cache';
import { notify, playNotificationSound } from '../util/notify';
import { messageSummary } from '../util/format';
import { presence } from './presence.svelte';

type SendState = 'sending' | 'failed';

const PAGE = 50;
const SYNC_PAGE = 500;

function byTime(a: Message, b: Message) {
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : a.id < b.id ? -1 : 1;
}

class AppState {
  phase = $state<'loading' | 'auth' | 'ready'>('loading');
  meId = $state<string | null>(null);
  online = $state(false);

  profiles = $state<Record<string, Profile>>({});
  groups = $state<Group[]>([]);
  channels = $state<Channel[]>([]);
  members = $state<Member[]>([]);

  /** Загруженные сообщения открытых каналов, по порядку. */
  messages = $state<Record<string, Message[]>>({});
  hasMore = $state<Record<string, boolean>>({});
  /** Последнее сообщение каждого канала (для списка чатов). */
  last = $state<Record<string, Message>>({});
  unread = $state<Record<string, number>>({});
  sendState = $state<Record<string, SendState>>({});
  receipts = $state<Record<string, Record<string, ReadReceipt>>>({});

  /** Что открыто: groupId = null значит «Личные». */
  groupId = $state<string | null>(null);
  channelId = $state<string | null>(null);
  /** На телефоне видна одна панель. */
  mobilePane = $state<'list' | 'chat'>('list');

  private lastRead: Record<string, string> = {};
  private cursor: string | null = null;
  private unsub: (() => void) | null = null;
  private flushing = false;
  private flushRequested = false;
  private sendingReceipts = new Set<string>();
  private pendingReceipts = new Map<string, Message>();
  private localBlobs = new Map<string, string>(); // id сообщения → objectURL до загрузки
  private wasOnline = false;

  // ───────────── производные ─────────────
  get me(): Profile | null {
    return this.meId ? (this.profiles[this.meId] ?? null) : null;
  }
  get dms(): Group[] {
    return this.groups.filter((g) => g.kind === 'dm').sort((a, b) => this.groupActivity(b) - this.groupActivity(a));
  }
  get realGroups(): Group[] {
    return this.groups.filter((g) => g.kind === 'group').sort((a, b) => a.created_at.localeCompare(b.created_at));
  }
  get currentGroup(): Group | null {
    return this.groups.find((g) => g.id === this.groupId) ?? null;
  }
  get currentChannel(): Channel | null {
    return this.channels.find((c) => c.id === this.channelId) ?? null;
  }
  channelsOf(groupId: string): Channel[] {
    return this.channels.filter((c) => c.group_id === groupId).sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
  }
  membersOf(groupId: string): Member[] {
    return this.members.filter((m) => m.group_id === groupId);
  }
  dmPartner(group: Group): Profile | null {
    const other = this.membersOf(group.id).find((m) => m.user_id !== this.meId);
    return other ? (this.profiles[other.user_id] ?? null) : null;
  }
  groupTitle(group: Group | null): string {
    if (!group) return 'Личные';
    if (group.kind === 'dm') return this.dmPartner(group)?.display_name ?? 'Личный чат';
    return group.name ?? 'Группа';
  }
  nameOf(userId: string, groupId?: string): string {
    const nick = groupId ? this.members.find((m) => m.group_id === groupId && m.user_id === userId)?.nickname : null;
    return nick || this.profiles[userId]?.display_name || 'Кто-то';
  }
  groupActivity(g: Group): number {
    let t = Date.parse(g.created_at);
    for (const c of this.channelsOf(g.id)) {
      const l = this.last[c.id];
      if (l) t = Math.max(t, Date.parse(l.created_at));
    }
    return t;
  }
  groupUnread(groupId: string): number {
    return this.channelsOf(groupId).reduce((n, c) => n + (this.unread[c.id] ?? 0), 0);
  }
  get dmUnread(): number {
    return this.dms.reduce((n, g) => n + this.groupUnread(g.id), 0);
  }

  // ───────────── вход ─────────────
  readCount(message: Message) {
    const members = this.membersOf(message.group_id);
    return Object.values(this.receipts[message.channel_id] ?? {}).filter((receipt) =>
      receipt.user_id !== this.meId && members.some((member) => member.user_id === receipt.user_id)
      && (receipt.message_at > message.created_at || (receipt.message_at === message.created_at && receipt.message_id >= message.id)),
    ).length;
  }

  private receiveReceipt(receipt: ReadReceipt) {
    const at = new Date(receipt.message_at).toISOString();
    if (!this.receipts[receipt.channel_id]) this.receipts[receipt.channel_id] = {};
    const channel = this.receipts[receipt.channel_id];
    const current = channel[receipt.user_id];
    if (!current || current.message_at < at || (current.message_at === at && current.message_id < receipt.message_id)) {
      channel[receipt.user_id] = { ...receipt, message_at: at };
    }
  }

  private async loadReceipts(channelId: string) {
    const account = this.meId;
    try {
      const receipts = await api.listReceipts(channelId);
      if (this.meId === account) for (const receipt of receipts) this.receiveReceipt(receipt);
    } catch (error) {
      if (this.online) console.warn('Could not fetch read receipts', error);
    }
  }

  seeMessages(messages: Message[]) {
    if (!this.meId || api.kind === 'demo' || document.visibilityState !== 'visible') return;
    const message = messages.filter((m) => m.author_id !== this.meId && this.channelId === m.channel_id).sort(byTime).at(-1);
    if (!message) return;
    const current = this.receipts[message.channel_id]?.[this.meId];
    if (current && (current.message_at > message.created_at
      || (current.message_at === message.created_at && current.message_id >= message.id))) return;
    const pending = this.pendingReceipts.get(message.channel_id);
    if (!pending || byTime(pending, message) < 0) this.pendingReceipts.set(message.channel_id, message);
    if (this.online) void this.sendReceipt(message.channel_id);
  }

  private async sendReceipt(channelId: string) {
    const userId = this.meId;
    if (!userId || this.sendingReceipts.has(channelId)) return;
    this.sendingReceipts.add(channelId);
    try {
      while (this.meId === userId) {
        const message = this.pendingReceipts.get(channelId);
        if (!message) break;
        this.pendingReceipts.delete(channelId);
        try {
          await api.markMessageRead(message.id);
          if (this.meId === userId) this.receiveReceipt({ channel_id: channelId, user_id: userId, message_id: message.id, message_at: message.created_at });
        } catch {
          if (this.meId === userId && !this.pendingReceipts.has(channelId)) this.pendingReceipts.set(channelId, message);
          break;
        }
      }
    } finally {
      this.sendingReceipts.delete(channelId);
    }
  }

  async start() {
    try {
      this.meId = await api.currentUserId();
    } catch {
      this.meId = null;
    }
    if (!this.meId) {
      this.phase = 'auth';
      return;
    }
    await this.loadFromCache();
    this.phase = 'ready';
    this.connect();
  }

  async signIn(username: string, password: string) {
    await api.signIn(username, password);
    await this.afterAuth();
  }

  async register(code: string, username: string, displayName: string, password: string) {
    await api.redeemInvite(code, username, displayName, password);
    await this.afterAuth();
  }

  private async afterAuth() {
    const prev = await cache.get<string>('owner');
    this.meId = await api.currentUserId();
    if (prev && prev !== this.meId) await cache.clear(); // другой аккаунт на том же устройстве
    await cache.set('owner', this.meId);
    await this.loadFromCache();
    this.phase = 'ready';
    this.connect();
  }

  async signOut() {
    this.unsub?.();
    this.unsub = null;
    await api.signOut();
    await cache.clear();
    for (const url of this.localBlobs.values()) URL.revokeObjectURL(url);
    this.localBlobs.clear();
    Object.assign(this, { profiles: {}, groups: [], channels: [], members: [], messages: {}, last: {}, unread: {}, sendState: {}, receipts: {} });
    this.pendingReceipts.clear();
    this.lastRead = {};
    this.cursor = null;
    this.groupId = null;
    this.channelId = null;
    this.meId = null;
    this.phase = 'auth';
  }

  private async loadFromCache() {
    const [snap, profiles, last, read, cursor, outbox, view] = await Promise.all([
      cache.get<{ groups: Group[]; channels: Channel[]; members: Member[] }>('snapshot'),
      cache.get<Profile[]>('profiles'),
      cache.get<Record<string, Message>>('last'),
      cache.get<Record<string, string>>('read'),
      cache.get<string>('cursor'),
      cache.outbox(),
      cache.get<{ groupId: string | null; channelId: string | null }>('view'),
    ]);
    if (snap) Object.assign(this, { groups: snap.groups, channels: snap.channels, members: snap.members });
    if (profiles) this.profiles = Object.fromEntries(profiles.map((p) => [p.id, p]));
    this.last = last ?? {};
    this.lastRead = read ?? {};
    this.cursor = cursor ?? null;
    for (const item of outbox) {
      this.sendState[item.message.id] = 'failed';
      if (item.blob) this.localBlobs.set(item.message.id, URL.createObjectURL(item.blob));
    }
    if (view && (view.groupId === null || this.groups.some((g) => g.id === view.groupId))) {
      this.groupId = view.groupId;
      if (view.channelId && this.channels.some((c) => c.id === view.channelId)) await this.openChannel(view.channelId, false);
    }
    await this.recountUnread(this.channels.map((c) => c.id));
  }

  // ───────────── сеть ─────────────
  private connect() {
    this.unsub?.();
    this.unsub = api.subscribe({
      onMessage: (m) => this.ingest([m], true),
      onReceipt: (receipt) => this.receiveReceipt(receipt),
      onPresence: (row) => presence.receive(row),
      onStructureChanged: () => void this.refreshStructure(),
      onStatus: (ok) => {
        this.online = ok;
        if (ok && !this.wasOnline) void this.resync();
        this.wasOnline = ok;
      },
    });
    if (typeof window !== 'undefined' && !(window as any).__comsysListeners) {
      (window as any).__comsysListeners = true;
      window.addEventListener('online', () => void this.resync());
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          void this.resync();
          if (this.channelId) this.markRead(this.channelId);
        }
      });
    }
  }

  /** Подписка уже есть: забираем всё, что пропустили, и досылаем очередь. */
  async resync() {
    if (!this.meId) return;
    try {
      await this.refreshStructure();
      void presence.refresh();
      if (this.channelId) void this.loadReceipts(this.channelId);
      for (const channelId of this.pendingReceipts.keys()) void this.sendReceipt(channelId);
      await this.catchUp();
      await this.flushOutbox();
    } catch (e) {
      console.warn('resync failed', e);
    }
  }

  async refreshStructure() {
    const [snap, profiles] = await Promise.all([api.snapshot(), api.listProfiles()]);
    this.groups = snap.groups;
    this.channels = snap.channels;
    this.members = snap.members;
    this.profiles = Object.fromEntries(profiles.map((p) => [p.id, p]));
    await cache.set('snapshot', $state.snapshot(snap));
    await cache.set('profiles', profiles);
    if (this.groupId && !this.groups.some((g) => g.id === this.groupId)) {
      this.groupId = null;
      this.channelId = null;
    }
  }

  private async catchUp() {
    for (let i = 0; i < 20; i++) {
      const list = await api.fetchSince(this.cursor, SYNC_PAGE);
      await this.ingest(list, false);
      if (list.length < SYNC_PAGE) break;
    }
  }

  /** Принять сообщения с сервера (из синхронизации или realtime). */
  async ingest(list: Message[], live: boolean) {
    if (!list.length) return;
    await cache.putMessages(list);
    const touched = new Set<string>();
    for (const m of list) {
      touched.add(m.channel_id);
      delete this.sendState[m.id];
      const arr = this.messages[m.channel_id];
      if (arr) {
        const i = arr.findIndex((x) => x.id === m.id);
        if (i >= 0) arr[i] = m;
        else arr.push(m);
      }
      const prev = this.last[m.channel_id];
      if (!prev || prev.id === m.id || byTime(prev, m) <= 0) this.last[m.channel_id] = m;
      if (!this.cursor || m.created_at > this.cursor) this.cursor = m.created_at;
      if (m.author_id === this.meId) this.bumpRead(m.channel_id, m.created_at);
      else if (live && !m.edited_at && !m.deleted_at) this.maybeNotify(m);
    }
    for (const c of touched) this.messages[c]?.sort(byTime);
    if (this.channelId && touched.has(this.channelId) && document.visibilityState === 'visible') this.markRead(this.channelId);
    await cache.set('cursor', this.cursor);
    await cache.set('last', $state.snapshot(this.last));
    await this.recountUnread([...touched]);
  }

  private maybeNotify(m: Message) {
    if (this.channelId === m.channel_id && document.visibilityState === 'visible' && document.hasFocus()
      && (!matchMedia('(max-width: 760px)').matches || this.mobilePane === 'chat')) return;
    void playNotificationSound();
    const group = this.groups.find((g) => g.id === m.group_id) ?? null;
    const who = this.nameOf(m.author_id, m.group_id);
    const title = group?.kind === 'group' ? `${who} · ${this.groupTitle(group)}` : who;
    notify(title, messageSummary(m), () => {
      this.openGroup(m.group_id);
      void this.openChannel(m.channel_id);
    });
  }

  private bumpRead(channelId: string, at: string) {
    if (!this.lastRead[channelId] || at > this.lastRead[channelId]) this.lastRead[channelId] = at;
  }

  markRead(channelId: string) {
    const l = this.last[channelId];
    if (l) this.bumpRead(channelId, l.created_at);
    if (this.unread[channelId]) this.unread[channelId] = 0;
    void cache.set('read', { ...this.lastRead });
  }

  private async recountUnread(channelIds: string[]) {
    if (!this.meId) return;
    for (const id of channelIds) {
      if (id === this.channelId && document.visibilityState === 'visible') {
        this.unread[id] = 0;
        continue;
      }
      const n = await cache.countAfter(id, this.lastRead[id] ?? '', this.meId);
      if ((this.unread[id] ?? 0) !== n) this.unread[id] = n;
    }
  }

  // ───────────── навигация ─────────────
  openGroup(groupId: string | null) {
    this.groupId = groupId;
    const g = this.groups.find((x) => x.id === groupId);
    if (g && g.kind === 'group') {
      const first = this.channelsOf(g.id).find((c) => c.kind === 'text');
      if (first) void this.openChannel(first.id, false);
    } else if (groupId === null) {
      this.channelId = null;
      this.mobilePane = 'list';
    }
    this.saveView();
  }

  async openChannel(channelId: string, showOnMobile = true) {
    const ch = this.channels.find((c) => c.id === channelId);
    if (!ch) return;
    if (this.groups.find((g) => g.id === ch.group_id)?.kind === 'group') this.groupId = ch.group_id;
    this.channelId = channelId;
    if (api.kind === 'supabase') void this.loadReceipts(channelId);
    if (showOnMobile) this.mobilePane = 'chat';
    this.saveView();
    if (!this.messages[channelId]) {
      const cached = await cache.channelMessages(channelId, PAGE * 2);
      const pending = (await cache.outbox()).filter((o) => o.message.channel_id === channelId).map((o) => o.message);
      this.messages[channelId] = [...cached, ...pending.filter((p) => !cached.some((c) => c.id === p.id))].sort(byTime);
      this.hasMore[channelId] = true;
      if (cached.length < PAGE) void this.loadOlder(channelId);
    }
    this.markRead(channelId);
  }

  private saveView() {
    void cache.set('view', { groupId: this.groupId, channelId: this.channelId });
  }

  async loadOlder(channelId: string) {
    if (this.hasMore[channelId] === false) return;
    const arr = this.messages[channelId] ?? [];
    const oldest = arr.find((m) => !this.sendState[m.id])?.created_at ?? null;
    try {
      const older = await api.fetchHistory(channelId, oldest, PAGE);
      this.hasMore[channelId] = older.length === PAGE;
      if (older.length) {
        await cache.putMessages(older);
        const have = new Set(arr.map((m) => m.id));
        this.messages[channelId] = [...older.filter((m) => !have.has(m.id)), ...arr].sort(byTime);
        const newest = older[older.length - 1];
        const prev = this.last[channelId];
        if (!prev || byTime(prev, newest) < 0) this.last[channelId] = newest;
      }
    } catch {
      /* офлайн: покажем то, что есть в кэше */
    }
  }

  // ───────────── отправка ─────────────
  async sendText(body: string, replyTo: string | null = null) {
    const text = body.trim();
    if (!text || !this.channelId) return;
    await this.enqueue({ kind: 'text', body: text, attachments: [], reply_to: replyTo });
  }

  async sendVoice(blob: Blob, mime: string, durationMs: number, waveform: number[]) {
    if (!this.channelId) return;
    const att: Attachment = { provider: 'demo', key: '', mime, size: blob.size, duration_ms: durationMs, waveform };
    await this.enqueue({ kind: 'voice', body: '', attachments: [att], reply_to: null }, blob, mime);
  }

  async sendMedia(file: File, caption: string, replyTo: string | null) {
    if (!this.channelId) return;
    const att: Attachment = { provider: 'demo', key: '', mime: file.type, size: file.size };
    await this.enqueue({ kind: 'media', body: caption.trim(), attachments: [att], reply_to: replyTo }, file, file.type);
  }

  private async enqueue(part: Pick<Message, 'kind' | 'body' | 'attachments' | 'reply_to'>, blob?: Blob, mime?: string) {
    const ch = this.currentChannel!;
    const m: Message = {
      id: ulid(),
      channel_id: ch.id,
      group_id: ch.group_id,
      author_id: this.meId!,
      created_at: new Date().toISOString(),
      edited_at: null,
      deleted_at: null,
      ...part,
    };
    if (blob) this.localBlobs.set(m.id, URL.createObjectURL(blob));
    this.sendState[m.id] = 'sending';
    (this.messages[ch.id] ??= []).push(m);
    this.last[ch.id] = m;
    await cache.putOutbox({ message: $state.snapshot(m) as Message, blob, mime, tries: 0 });
    void this.flushOutbox();
  }

  async retry(id: string) {
    this.sendState[id] = 'sending';
    await this.flushOutbox();
  }

  async discard(id: string) {
    await cache.removeOutbox(id);
    const url = this.localBlobs.get(id);
    if (url) URL.revokeObjectURL(url);
    this.localBlobs.delete(id);
    delete this.sendState[id];
    for (const arr of Object.values(this.messages)) {
      const i = arr.findIndex((m) => m.id === id);
      if (i >= 0) arr.splice(i, 1);
    }
  }

  async flushOutbox() {
    if (this.flushing) {
      this.flushRequested = true;
      return;
    }
    this.flushing = true;
    try {
      const items = (await cache.outbox()).sort((a, b) => (a.message.id < b.message.id ? -1 : 1));
      for (const item of items) {
        this.sendState[item.message.id] = 'sending';
        try {
          await this.sendOne(item);
        } catch (e) {
          item.tries++;
          await cache.putOutbox(item);
          this.sendState[item.message.id] = 'failed';
          if (e instanceof ApiError && e.code === 'network') break; // нет сети: остальное позже
        }
      }
    } finally {
      this.flushing = false;
      if (this.flushRequested) {
        this.flushRequested = false;
        void this.flushOutbox();
      }
    }
  }

  private async sendOne(item: OutboxItem) {
    const m = item.message;
    if (item.blob && m.attachments[0] && !m.attachments[0].key) {
      const up = await api.uploadMedia(m.group_id, m.channel_id, item.blob, item.mime ?? item.blob.type);
      m.attachments[0] = { ...m.attachments[0], ...up };
      await cache.putOutbox(item); // загрузку не повторяем
    }
    const saved = await api.sendMessage({
      id: m.id,
      channel_id: m.channel_id,
      kind: m.kind,
      body: m.body,
      attachments: m.attachments,
      reply_to: m.reply_to,
    });
    await cache.removeOutbox(m.id);
    if (m.kind === 'media' && api.kind === 'supabase') {
      const url = this.localBlobs.get(m.id);
      this.localBlobs.delete(m.id);
      if (url) setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
    await this.ingest([saved], false);
  }

  async edit(id: string, body: string) {
    await api.editMessage(id, body.trim());
  }
  async remove(id: string) {
    await api.deleteMessage(id);
  }

  /** Ссылка для проигрывания медиа: локальная копия, пока не загрузилось, иначе подписанная. */
  async mediaUrl(m: Message, att: Attachment): Promise<string> {
    const local = this.localBlobs.get(m.id);
    if (local) return local;
    return api.mediaUrl(att);
  }

  // ───────────── группы ─────────────
  async createGroup(name: string, memberIds: string[]) {
    const id = await api.createGroup(name, memberIds);
    await this.refreshStructure();
    this.openGroup(id);
    this.mobilePane = 'chat';
    return id;
  }

  async openDM(userId: string) {
    const id = await api.openDM(userId);
    await this.refreshStructure();
    this.groupId = null;
    const ch = this.channelsOf(id)[0];
    if (ch) await this.openChannel(ch.id);
  }

  async addMembers(groupId: string, ids: string[]) {
    await api.addMembers(groupId, ids);
    await this.refreshStructure();
  }

  async leaveGroup(groupId: string) {
    await api.leaveGroup(groupId);
    await this.refreshStructure();
    this.openGroup(null);
  }

  async renameGroup(groupId: string, name: string) {
    await api.renameGroup(groupId, name);
    await this.refreshStructure();
  }

  async createChannel(groupId: string, name: string, kind: 'text' | 'voice') {
    await api.createChannel(groupId, name, kind);
    await this.refreshStructure();
  }
}

export const app = new AppState();
