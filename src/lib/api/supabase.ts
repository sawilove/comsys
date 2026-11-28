import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { FunctionsHttpError } from '@supabase/supabase-js';
import {
  ApiError,
  type Attachment,
  type Backend,
  type Message,
  type NetworkSnapshot,
  type NewMessage,
  type Profile,
  type ProfileImages,
  type ProfilePatch,
  type RealtimeHandlers,
  type ReadReceipt,
} from './types';
import { MEDIA_PROVIDER, SUPABASE_ANON_KEY, SUPABASE_URL, USERNAME_EMAIL_DOMAIN } from './config';
import { PROFILE_MEDIA_BUCKET, PROFILE_MEDIA_PREFIX, profileImageExtension } from '../util/profile';

/** Realtime и REST отдают время в разном виде: приводим к одному ISO, чтобы сортировка и курсор совпадали. */
function norm(m: Message): Message {
  const iso = (v: string | null) => (v ? new Date(v).toISOString() : null);
  return { ...m, created_at: iso(m.created_at)!, edited_at: iso(m.edited_at), deleted_at: iso(m.deleted_at), attachments: m.attachments ?? [] };
}

const MSG_COLUMNS = 'id,channel_id,group_id,author_id,kind,body,attachments,reply_to,created_at,edited_at,deleted_at';

function extFor(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime.startsWith('image/')) return mime.slice(6);
  if (mime === 'video/mp4') return 'mp4';
  if (mime === 'video/quicktime') return 'mov';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4') || mime.includes('aac') || mime.includes('m4a')) return 'm4a';
  if (mime.includes('mpeg')) return 'mp3';
  return 'bin';
}

async function functionError(error: unknown): Promise<ApiError> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = await error.context.json();
      return new ApiError(body.error ?? 'server_error', body.detail ?? body.error);
    } catch {
      /* ignore */
    }
  }
  return new ApiError('network', String((error as Error)?.message ?? error));
}

export class SupabaseBackend implements Backend {
  readonly kind = 'supabase' as const;
  private sb: SupabaseClient;
  private urlCache = new Map<string, { url: string; until: number }>();

  constructor() {
    this.sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'comsys-auth' },
      realtime: { params: { eventsPerSecond: 20 } },
    });
  }

  private check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
    if (res.error) throw new ApiError(res.error.code ?? 'db_error', res.error.message);
    return res.data;
  }

  async currentUserId() {
    const { data } = await this.sb.auth.getSession();
    return data.session?.user.id ?? null;
  }

  async signIn(username: string, password: string) {
    const email = `${username.trim().toLowerCase()}@${USERNAME_EMAIL_DOMAIN}`;
    const { error } = await this.sb.auth.signInWithPassword({ email, password });
    if (error) {
      if (/invalid/i.test(error.message)) throw new ApiError('bad_credentials');
      throw new ApiError('network', error.message);
    }
  }

  async redeemInvite(code: string, username: string, displayName: string, password: string) {
    const { error } = await this.sb.functions.invoke('redeem-invite', {
      body: { code, username, display_name: displayName, password },
    });
    if (error) throw await functionError(error);
    await this.signIn(username, password);
  }

  async signOut() {
    await this.sb.removeAllChannels();
    await this.sb.auth.signOut();
    this.urlCache.clear();
  }

  async listProfiles(): Promise<Profile[]> {
    return this.check(
      await this.sb.from('profiles').select('id,username,display_name,avatar_url,profile,status,is_admin,is_developer').order('display_name'),
    ) as Profile[];
  }

  async updateMyProfile(patch: ProfilePatch, images: ProfileImages = {}) {
    const id = await this.currentUserId();
    if (!id) throw new ApiError('unauthorized');
    const current = this.check(await this.sb.from('profiles').select('avatar_url,profile').eq('id', id).single()) as Pick<Profile, 'avatar_url' | 'profile'>;
    const next = { ...patch };
    if (patch.profile || images.banner !== undefined) next.profile = { ...current.profile, ...patch.profile };
    const bucket = this.sb.storage.from(PROFILE_MEDIA_BUCKET);
    const uploaded: string[] = [];
    const replaced: string[] = [];
    const upload = async (file: File | null, previous: string | null | undefined) => {
      if (previous?.startsWith(`${PROFILE_MEDIA_PREFIX}${id}/`)) {
        replaced.push(previous.slice(PROFILE_MEDIA_PREFIX.length));
      }
      if (!file) return null;
      const path = `${id}/${crypto.randomUUID()}.${profileImageExtension(file)}`;
      this.check(await bucket.upload(path, file, { contentType: file.type, upsert: false }));
      uploaded.push(path);
      return PROFILE_MEDIA_PREFIX + path;
    };
    try {
      if (images.avatar !== undefined) next.avatar_url = await upload(images.avatar, current.avatar_url);
      if (images.banner !== undefined && next.profile) {
        const banner = await upload(images.banner, current.profile.banner);
        if (banner) next.profile.banner = banner;
        else delete next.profile.banner;
      }
    } catch (error) {
      if (uploaded.length) await bucket.remove(uploaded).catch(() => undefined);
      throw error;
    }
    let update = this.sb.from('profiles').update(next).eq('id', id);
    if (next.profile) update = update.eq('profile', JSON.stringify(current.profile));
    if (images.avatar !== undefined) {
      update = current.avatar_url === null ? update.is('avatar_url', null) : update.eq('avatar_url', current.avatar_url);
    }
    const updated = this.check(await update.select('id').maybeSingle());
    if (!updated) {
      if (uploaded.length) await bucket.remove(uploaded).catch(() => undefined);
      throw new Error('Профиль изменился. Обнови страницу и повтори сохранение.');
    }
    if (replaced.length) await bucket.remove(replaced).catch(() => undefined);
  }

  async profileImageUrl(reference: string) {
    if (!reference.startsWith(PROFILE_MEDIA_PREFIX)) return /^https:\/\//i.test(reference) ? reference : '';
    const cached = this.urlCache.get(reference);
    if (cached && cached.until > Date.now()) return cached.url;
    const path = reference.slice(PROFILE_MEDIA_PREFIX.length);
    const { signedUrl } = this.check(await this.sb.storage.from(PROFILE_MEDIA_BUCKET).createSignedUrl(path, 3600))!;
    this.urlCache.set(reference, { url: signedUrl, until: Date.now() + 50 * 60 * 1000 });
    return signedUrl;
  }

  async snapshot(): Promise<NetworkSnapshot> {
    const [groups, channels, members] = await Promise.all([
      this.sb.from('groups').select('id,kind,name,icon_url,owner_id,created_at'),
      this.sb.from('channels').select('id,group_id,kind,name,position').order('position'),
      this.sb.from('members').select('group_id,user_id,nickname'),
    ]);
    return {
      groups: this.check(groups) as NetworkSnapshot['groups'],
      channels: this.check(channels) as NetworkSnapshot['channels'],
      members: this.check(members) as NetworkSnapshot['members'],
    };
  }

  async createGroup(name: string, memberIds: string[]) {
    return this.check(await this.sb.rpc('create_group', { p_name: name, p_members: memberIds })) as string;
  }
  async openDM(userId: string) {
    return this.check(await this.sb.rpc('open_dm', { p_user: userId })) as string;
  }
  async addMembers(groupId: string, userIds: string[]) {
    this.check(await this.sb.rpc('add_members', { p_group: groupId, p_users: userIds }));
  }
  async leaveGroup(groupId: string) {
    this.check(await this.sb.rpc('leave_group', { p_group: groupId }));
  }
  async renameGroup(groupId: string, name: string) {
    this.check(await this.sb.from('groups').update({ name }).eq('id', groupId));
  }
  async createChannel(groupId: string, name: string, kind: 'text' | 'voice') {
    this.check(await this.sb.from('channels').insert({ group_id: groupId, name, kind, position: kind === 'voice' ? 100 : 10 }));
  }
  async createInvite(maxUses: number, days: number) {
    return this.check(await this.sb.rpc('create_invite', { p_max_uses: maxUses, p_days: days })) as string;
  }

  async fetchSince(since: string | null, limit: number): Promise<Message[]> {
    let q = this.sb.from('messages').select(MSG_COLUMNS).order('created_at', { ascending: true }).limit(limit);
    if (since) q = q.gte('created_at', since);
    else q = q.gte('created_at', new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString());
    return (this.check(await q) as Message[]).map(norm);
  }

  async fetchHistory(channelId: string, before: string | null, limit: number): Promise<Message[]> {
    let q = this.sb.from('messages').select(MSG_COLUMNS).eq('channel_id', channelId).order('created_at', { ascending: false }).limit(limit);
    if (before) q = q.lt('created_at', before);
    return (this.check(await q) as Message[]).map(norm).reverse();
  }

  async sendMessage(m: NewMessage): Promise<Message> {
    const me = await this.currentUserId();
    const row = { ...m, author_id: me };
    const res = await this.sb.from('messages').insert(row).select(MSG_COLUMNS).single();
    if (res.error?.code === '23505') {
      // Уже было отправлено (повтор из очереди): берём серверную версию.
      return norm(this.check(await this.sb.from('messages').select(MSG_COLUMNS).eq('id', m.id).single()) as Message);
    }
    return norm(this.check(res) as Message);
  }

  async listReceipts(channelId: string) {
    return this.check(await this.sb.from('read_receipts').select('channel_id,user_id,message_id,message_at').eq('channel_id', channelId)) as ReadReceipt[];
  }

  async markMessageRead(messageId: string) {
    this.check(await this.sb.rpc('mark_message_read', { p_message: messageId }));
  }

  async editMessage(id: string, body: string) {
    this.check(await this.sb.from('messages').update({ body }).eq('id', id));
  }
  async deleteMessage(id: string) {
    this.check(await this.sb.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', id));
  }

  async uploadMedia(groupId: string, channelId: string, blob: Blob, mime: string) {
    const key = `${groupId}/${channelId}/${crypto.randomUUID()}.${extFor(mime)}`;
    if (MEDIA_PROVIDER === 'b2') {
      const { data, error } = await this.sb.functions.invoke('media', {
        body: { action: 'upload', key, mime, size: blob.size },
      });
      if (error) throw await functionError(error);
      const put = await fetch(data.url, { method: 'PUT', headers: data.headers, body: blob });
      if (!put.ok) throw new ApiError('upload_failed', `B2 ${put.status}`);
      return { provider: 'b2' as const, key };
    }
    this.check(await this.sb.storage.from('media').upload(key, blob, { contentType: mime, upsert: false }));
    return { provider: 'supabase' as const, key };
  }

  async mediaUrl(att: Attachment): Promise<string> {
    const cached = this.urlCache.get(att.key);
    if (cached && cached.until > Date.now()) return cached.url;
    let url: string;
    if (att.provider === 'b2') {
      const { data, error } = await this.sb.functions.invoke('media', { body: { action: 'download', key: att.key } });
      if (error) throw await functionError(error);
      url = data.url;
    } else {
      const data = this.check(await this.sb.storage.from('media').createSignedUrl(att.key, 3600)) as { signedUrl: string };
      url = data.signedUrl;
    }
    this.urlCache.set(att.key, { url, until: Date.now() + 50 * 60 * 1000 });
    return url;
  }

  subscribe(h: RealtimeHandlers): () => void {
    const ch = this.sb
      .channel('comsys-db')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (p) => {
        if (p.new && (p.new as Message).id) h.onMessage(norm(p.new as Message));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, () => h.onStructureChanged())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'groups' }, () => h.onStructureChanged())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'channels' }, () => h.onStructureChanged())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => h.onStructureChanged())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'read_receipts' }, ({ new: row }) => {
        if ('message_id' in row) h.onReceipt(row as ReadReceipt);
      })
      .subscribe((status) => h.onStatus(status === 'SUBSCRIBED'));
    return () => {
      this.sb.removeChannel(ch);
    };
  }
}
