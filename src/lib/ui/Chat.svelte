<script lang="ts">
  import { app } from '../state/app.svelte';
  import { ui } from '../state/ui.svelte';
  import Icon from './Icon.svelte';
  import Avatar from './Avatar.svelte';
  import MessageList from './MessageList.svelte';
  import Composer from './Composer.svelte';
  import type { Message } from '../api';

  const channel = $derived(app.currentChannel!);
  const group = $derived(app.groups.find((g) => g.id === channel.group_id) ?? null);
  const partner = $derived(group?.kind === 'dm' ? app.dmPartner(group) : null);

  let replyTo = $state<Message | null>(null);
  let editing = $state<Message | null>(null);

  function back() {
    app.mobilePane = 'list';
  }
</script>

<section class="chat">
  <header>
    <button type="button" class="icon-btn back" onclick={back} aria-label="Назад"><Icon name="back" size={22} /></button>
    {#if partner}
      {@const id = partner.id}
      <button type="button" class="partner" aria-label={'Открыть профиль ' + partner.display_name}
        onclick={() => ui.open({ type: 'profile', userId: id })}>
        <Avatar {id} name={partner.display_name} url={partner.avatar_url} size={36} />
        <span class="t">
          <b>{partner.display_name}</b>
          <span class="muted">@{partner.username}</span>
        </span>
      </button>
    {:else}
      <span class="hash"><Icon name="hash" size={22} /></span>
      <div class="t">
        <b>{channel.name}</b>
        <span class="muted">{app.groupTitle(group)}</span>
      </div>
      <button type="button" class="icon-btn" onclick={() => group && ui.open({ type: 'group-info', groupId: group.id })} aria-label="Участники"><Icon name="users" size={20} /></button>
    {/if}
    {#if !app.online}<span class="offline" title="Сообщения уйдут, когда появится связь"><Icon name="clock" size={14} /> нет связи</span>{/if}
  </header>

  <MessageList channelId={channel.id} groupKind={group?.kind ?? 'group'} onreply={(m) => { replyTo = m; editing = null; }} onedit={(m) => { editing = m; replyTo = null; }} />

  <Composer bind:replyTo bind:editing />
</section>

<style>
  .chat { height: 100%; display: flex; flex-direction: column; }
  header {
    display: flex; align-items: center; gap: 10px; padding: 10px 14px; min-height: 60px; flex: none;
    padding-top: calc(10px + env(safe-area-inset-top));
    background: color-mix(in srgb, var(--bg) 82%, transparent); backdrop-filter: blur(16px);
    border-bottom: 1px solid var(--border); z-index: 2;
  }
  .t { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.2; }
  .partner { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; text-align: left; }
  .t b { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .t span { font-size: 12.5px; }
  .hash { color: var(--text-faint); display: grid; }
  .back { display: none; margin-left: -6px; }
  .offline { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; color: var(--text-muted); background: var(--bg-hover); padding: 4px 8px; border-radius: 8px; }
  @media (max-width: 760px) { .back { display: inline-grid; } }
</style>
