<script lang="ts">
  import { app } from '../state/app.svelte';
  import { ui } from '../state/ui.svelte';
  import Modal from './Modal.svelte';
  import Avatar from './Avatar.svelte';
  import Icon from './Icon.svelte';
  import PeopleSelect from './PeopleSelect.svelte';
  import { describeError } from '../util/format';

  let { groupId }: { groupId: string } = $props();
  const group = $derived(app.groups.find((g) => g.id === groupId));
  const members = $derived(app.membersOf(groupId));
  const isOwner = $derived(group?.owner_id === app.meId);

  let tab = $state<'members' | 'add' | 'settings'>('members');
  let adding = $state<string[]>([]);
  let newName = $state('');
  let chanName = $state('');
  let chanKind = $state<'text' | 'voice'>('text');
  let busy = $state(false);

  $effect(() => {
    if (group && !newName) newName = group.name ?? '';
  });

  async function run(fn: () => Promise<unknown>, ok?: string) {
    busy = true;
    try {
      await fn();
      if (ok) ui.say(ok);
    } catch (e) {
      ui.say(describeError(e));
    } finally {
      busy = false;
    }
  }
</script>

{#if group}
  <Modal title={group.name ?? 'Группа'} onclose={() => ui.close()}>
    <div class="tabs">
      <button type="button" class:on={tab === 'members'} onclick={() => (tab = 'members')}>Участники · {members.length}</button>
      <button type="button" class:on={tab === 'add'} onclick={() => (tab = 'add')}>Добавить</button>
      <button type="button" class:on={tab === 'settings'} onclick={() => (tab = 'settings')}>Настройки</button>
    </div>

    {#if tab === 'members'}
      <div class="list">
        {#each members as m (m.user_id)}
          {@const p = app.profiles[m.user_id]}
          <div class="person">
            <Avatar id={m.user_id} name={p?.display_name ?? '?'} url={p?.avatar_url} crop={p?.profile?.avatarCrop} size={36} />
            <div class="n"><b>{m.nickname || p?.display_name}</b><span class="muted">@{p?.username}</span></div>
            {#if group.owner_id === m.user_id}<span class="tag">владелец</span>{/if}
            {#if m.user_id !== app.meId}
              <button type="button" class="icon-btn" title="Написать лично" onclick={() => run(async () => { await app.openDM(m.user_id); ui.close(); })}><Icon name="chat" size={16} /></button>
            {/if}
          </div>
        {/each}
      </div>
    {:else if tab === 'add'}
      <PeopleSelect bind:selected={adding} exclude={members.map((m) => m.user_id)} />
      <button type="button" class="btn block mt" disabled={busy || !adding.length} onclick={() => run(async () => { await app.addMembers(groupId, adding); adding = []; tab = 'members'; }, 'Добавлено')}>
        Добавить {adding.length || ''}
      </button>
      <p class="muted small">Добавлять могут владелец и роли с правом «управлять участниками».</p>
    {:else}
      <div class="form">
        <div class="field">
          <label for="rn">Название группы</label>
          <div class="inline">
            <input id="rn" class="input" bind:value={newName} maxlength="64" />
            <button type="button" class="btn ghost" disabled={busy || !newName.trim() || newName === group.name} onclick={() => run(() => app.renameGroup(groupId, newName.trim()), 'Переименовано')}>Сохранить</button>
          </div>
        </div>
        <div class="field">
          <label for="cn">Новый канал</label>
          <div class="inline">
            <select class="input sel" bind:value={chanKind}>
              <option value="text"># текст</option>
              <option value="voice">🔊 голос</option>
            </select>
            <input id="cn" class="input" bind:value={chanName} maxlength="48" placeholder="название" />
            <button type="button" class="btn ghost" disabled={busy || !chanName.trim()} onclick={() => run(async () => { await app.createChannel(groupId, chanName.trim(), chanKind); chanName = ''; }, 'Канал создан')}><Icon name="plus" size={18} /></button>
          </div>
        </div>
        <button type="button" class="btn danger block" disabled={busy} onclick={() => confirm(isOwner ? 'Выйти из группы? Владение перейдёт следующему участнику.' : 'Выйти из группы?') && run(async () => { await app.leaveGroup(groupId); ui.close(); }, 'Ты вышел из группы')}>
          <Icon name="door" size={18} /> Выйти из группы
        </button>
      </div>
    {/if}
  </Modal>
{/if}

<style>
  .tabs { display: flex; gap: 4px; margin-bottom: 12px; overflow-x: auto; }
  .tabs button { padding: 7px 12px; border-radius: 10px; font-weight: 600; font-size: 14px; color: var(--text-muted); white-space: nowrap; }
  .tabs button.on { background: var(--accent-soft); color: var(--accent); }
  .list { display: flex; flex-direction: column; gap: 2px; }
  .person { display: flex; align-items: center; gap: 10px; padding: 6px 4px; }
  .n { flex: 1; display: flex; flex-direction: column; line-height: 1.25; min-width: 0; }
  .n span { font-size: 12.5px; }
  .tag { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 8px; background: var(--accent-soft); color: var(--accent); }
  .form { display: flex; flex-direction: column; gap: 18px; }
  .inline { display: flex; gap: 8px; }
  .inline .input { flex: 1; min-width: 0; }
  .sel { flex: none !important; width: 110px; }
  .mt { margin-top: 12px; }
  .small { font-size: 12.5px; }
</style>
