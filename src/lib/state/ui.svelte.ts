import type { Attachment, Message } from '../api/types';

export type ModalKind =
  | { type: 'create-group' }
  | { type: 'new-dm' }
  | { type: 'group-info'; groupId: string }
  | { type: 'profile'; userId: string }
  | { type: 'media'; message: Message; attachment: Attachment; returnToProfile?: string }
  | { type: 'settings' };

class UiState {
  modal = $state<ModalKind | null>(null);
  toast = $state<string | null>(null);
  private t: ReturnType<typeof setTimeout> | null = null;

  open(m: ModalKind) {
    this.modal = m.type === 'media' && this.modal?.type === 'profile'
      ? { ...m, returnToProfile: this.modal.userId }
      : m;
  }
  close() {
    this.modal = this.modal?.type === 'media' && this.modal.returnToProfile
      ? { type: 'profile', userId: this.modal.returnToProfile }
      : null;
  }
  say(text: string) {
    this.toast = text;
    if (this.t) clearTimeout(this.t);
    this.t = setTimeout(() => (this.toast = null), 3200);
  }
}

export const ui = new UiState();
