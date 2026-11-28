// Доменные типы. Интерфейс знает только их, а не Supabase.

export interface Profile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  /** Оформление карточки в стиле Discord (версионированный JSON, этап «профиль»). */
  profile: { v: number; accent?: string; banner?: string; bio?: string; [k: string]: unknown };
  status: 'online' | 'idle' | 'dnd' | 'invisible';
  is_admin: boolean;
  is_developer?: boolean;
}

export type ProfilePatch = Partial<Pick<Profile, 'display_name' | 'avatar_url' | 'profile' | 'status'>>;
export type ProfileImages = { avatar?: File | null; banner?: File | null };

export interface Group {
  id: string;
  kind: 'group' | 'dm';
  name: string | null;
  icon_url: string | null;
  owner_id: string | null;
  created_at: string;
}

export interface Channel {
  id: string;
  group_id: string;
  kind: 'text' | 'voice';
  name: string;
  position: number;
}

export interface Member {
  group_id: string;
  user_id: string;
  nickname: string | null;
}

export interface Attachment {
  /** Где лежит файл: 'supabase' = Supabase Storage, 'b2' = Backblaze B2, 'demo' = память браузера. */
  provider: 'supabase' | 'b2' | 'demo';
  key: string;
  mime: string;
  size: number;
  /** Для голосовых и (позже) кружков. */
  duration_ms?: number;
  /** Громкость 0..100, ~48 столбиков для превью голосового. */
  waveform?: number[];
}

export type MessageKind = 'text' | 'voice' | 'media';
export interface ReadReceipt {
  channel_id: string;
  user_id: string;
  message_id: string;
  message_at: string;
}
export interface UserPresence {
  user_id: string;
  last_seen_at: string;
  last_active_at: string;
}

export interface Message {
  id: string; // ULID, создаётся на клиенте
  channel_id: string;
  group_id: string;
  author_id: string;
  kind: MessageKind;
  body: string;
  attachments: Attachment[];
  reply_to: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
}

export interface NetworkSnapshot {
  groups: Group[];
  channels: Channel[];
  members: Member[];
}

export interface RealtimeHandlers {
  onReceipt(receipt: ReadReceipt): void;
  onPresence(presence: UserPresence): void;
  onMessage(m: Message): void;
  /** Изменились группы, каналы или состав участников: перечитать снапшот. */
  onStructureChanged(): void;
  onStatus(online: boolean): void;
}

export interface NewMessage {
  id: string;
  channel_id: string;
  kind: MessageKind;
  body: string;
  attachments: Attachment[];
  reply_to: string | null;
}

/** Единственная точка входа к серверу. Переезд на Oracle/Matrix = новая реализация этого интерфейса. */
export interface Backend {
  readonly kind: 'supabase' | 'demo';
  currentUserId(): Promise<string | null>;
  signIn(username: string, password: string): Promise<void>;
  redeemInvite(code: string, username: string, displayName: string, password: string): Promise<void>;
  signOut(): Promise<void>;

  listProfiles(): Promise<Profile[]>;
  updateMyProfile(patch: ProfilePatch, images?: ProfileImages): Promise<void>;
  profileImageUrl(reference: string): Promise<string>;
  snapshot(): Promise<NetworkSnapshot>;

  createGroup(name: string, memberIds: string[]): Promise<string>;
  openDM(userId: string): Promise<string>;
  addMembers(groupId: string, userIds: string[]): Promise<void>;
  leaveGroup(groupId: string): Promise<void>;
  renameGroup(groupId: string, name: string): Promise<void>;
  createChannel(groupId: string, name: string, kind: 'text' | 'voice'): Promise<void>;
  createInvite(maxUses: number, days: number): Promise<string>;

  /** Всё, что пришло после `since` (время сервера), по всем доступным чатам. */
  fetchSince(since: string | null, limit: number): Promise<Message[]>;
  /** История канала до `before` (для прокрутки вверх). */
  fetchHistory(channelId: string, before: string | null, limit: number): Promise<Message[]>;
  listReceipts(channelId: string): Promise<ReadReceipt[]>;
  markMessageRead(messageId: string): Promise<void>;
  listPresence(): Promise<UserPresence[]>;
  touchPresence(activeAgeSeconds: number): Promise<void>;
  sendMessage(m: NewMessage): Promise<Message>;
  editMessage(id: string, body: string): Promise<void>;
  deleteMessage(id: string): Promise<void>;

  uploadMedia(groupId: string, channelId: string, blob: Blob, mime: string): Promise<Pick<Attachment, 'provider' | 'key'>>;
  mediaUrl(att: Attachment): Promise<string>;

  subscribe(h: RealtimeHandlers): () => void;
}

export class ApiError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
  }
}
