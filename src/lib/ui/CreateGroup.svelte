<script lang="ts">
  import { app } from '../state/app.svelte';
  import { ui } from '../state/ui.svelte';
  import Modal from './Modal.svelte';
  import PeopleSelect from './PeopleSelect.svelte';
  import Avatar from './Avatar.svelte';
  import { describeError } from '../util/format';

  let name = $state('');
  let selected = $state<string[]>([]);
  let busy = $state(false);
  let error = $state('');

  async function create(e: SubmitEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    busy = true;
    error = '';
    try {
      await app.createGroup(name.trim(), selected);
      ui.close();
      ui.say('Группа создана');
    } catch (err) {
      error = describeError(err);
    } finally {
      busy = false;
    }
  }
</script>

<Modal title="Новая группа" onclose={() => ui.close()}>
  <form onsubmit={create} class="form">
    <div class="head">
      <Avatar id={name || 'new'} name={name || '?'} size={56} radius="18px" />
      <div class="field grow">
        <label for="gname">Название</label>
        <!-- svelte-ignore a11y_autofocus -->
        <input id="gname" class="input" bind:value={name} maxlength="64" placeholder="Например, «Друзья»" autofocus required />
      </div>
    </div>
    <div class="field">
      <label for="people">Кого добавить {selected.length ? `· ${selected.length}` : ''}</label>
      <PeopleSelect bind:selected />
    </div>
    <p class="muted note">В группе сразу будут текстовый канал #общий и голосовой канал. Ты станешь владельцем.</p>
    {#if error}<p class="error">{error}</p>{/if}
    <button type="submit" class="btn block" disabled={busy || !name.trim()}>{busy ? 'Создаю…' : 'Создать группу'}</button>
  </form>
</Modal>

<style>
  .form { display: flex; flex-direction: column; gap: 14px; }
  .head { display: flex; gap: 14px; align-items: flex-end; }
  .grow { flex: 1; }
  .note { font-size: 13px; margin: 0; }
  .error { margin: 0; }
</style>
