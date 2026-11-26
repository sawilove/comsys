export type ModalKind =
  | { type: 'create-group' }
  | { type: 'new-dm' }
  | { type: 'group-info'; groupId: string }
  | { type: 'settings' };

class UiState {
  modal = $state<ModalKind | null>(null);
  toast = $state<string | null>(null);
  private t: ReturnType<typeof setTimeout> | null = null;

  open(m: ModalKind) {
    this.modal = m;
  }
  close() {
    this.modal = null;
  }
  say(text: string) {
    this.toast = text;
    if (this.t) clearTimeout(this.t);
    this.t = setTimeout(() => (this.toast = null), 3200);
  }
}

export const ui = new UiState();
