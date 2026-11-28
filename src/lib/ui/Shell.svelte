<script lang="ts">
  import { app } from '../state/app.svelte';
  import { ui } from '../state/ui.svelte';
  import Rail from './Rail.svelte';
  import Sidebar from './Sidebar.svelte';
  import Chat from './Chat.svelte';
  import CreateGroup from './CreateGroup.svelte';
  import NewDM from './NewDM.svelte';
  import GroupInfo from './GroupInfo.svelte';
  import Settings from './Settings.svelte';
  import Modal from './Modal.svelte';
  import ProfileCard from './ProfileCard.svelte';
  import Icon from './Icon.svelte';
</script>

<div class="shell" class:chat-open={app.mobilePane === 'chat'}>
  <div class="nav">
    <Rail />
    <Sidebar />
  </div>
  <main class="main">
    {#if app.currentChannel}
      {#key app.channelId}<Chat />{/key}
    {:else}
      <div class="empty">
        <div class="bubble"><Icon name="chat" size={34} /></div>
        <h2>{app.groupId ? 'Выбери канал' : 'Выбери чат'}</h2>
        <p class="muted">или создай группу для друзей</p>
        <button type="button" class="btn" onclick={() => ui.open({ type: 'create-group' })}><Icon name="plus" size={18} /> Новая группа</button>
      </div>
    {/if}
  </main>
</div>

{#if ui.modal?.type === 'create-group'}<CreateGroup />{/if}
{#if ui.modal?.type === 'new-dm'}<NewDM />{/if}
{#if ui.modal?.type === 'group-info'}<GroupInfo groupId={ui.modal.groupId} />{/if}
{#if ui.modal?.type === 'settings'}<Settings />{/if}
{#if ui.modal?.type === 'profile'}
  {@const person = app.profiles[ui.modal.userId]}
  {#if person}
    <Modal title="Профиль" onclose={() => ui.close()}>
      <ProfileCard {person} />
    </Modal>
  {/if}
{/if}

{#if ui.toast}<div class="toast" role="status">{ui.toast}</div>{/if}

<style>
  .shell { height: 100%; display: flex; overflow: hidden; }
  .nav { display: flex; flex: none; height: 100%; }
  .main { flex: 1; min-width: 0; height: 100%; background: var(--chat-bg); }
  .empty { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; text-align: center; padding: 24px; }
  .empty h2 { margin: 12px 0 0; font-size: 20px; }
  .empty p { margin: 0 0 14px; }
  .bubble { width: 72px; height: 72px; border-radius: 24px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); }
  .toast {
    position: fixed; left: 50%; bottom: calc(24px + env(safe-area-inset-bottom)); transform: translateX(-50%); z-index: 60;
    background: var(--text); color: var(--bg); padding: 10px 16px; border-radius: 12px; font-weight: 500; box-shadow: var(--shadow);
    animation: rise .2s ease-out; max-width: calc(100% - 32px);
  }
  @keyframes rise { from { opacity: 0; transform: translate(-50%, 10px); } }

  @media (max-width: 760px) {
    .nav { width: 100%; }
    .main { display: none; }
    .shell.chat-open .nav { display: none; }
    .shell.chat-open .main { display: block; }
  }
</style>
