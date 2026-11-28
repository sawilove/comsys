<script lang="ts">
  import { app } from '../state/app.svelte';
  import { ui } from '../state/ui.svelte';
  import Avatar from './Avatar.svelte';
  import Icon from './Icon.svelte';
  import BrandMark from './BrandMark.svelte';
</script>

<nav class="rail scroll" aria-label="Группы">
  <button type="button" class="item" class:active={app.groupId === null} onclick={() => app.openGroup(null)} title="Личные сообщения">
    <span class="pill"></span>
    <span class="home brand"><BrandMark size={46} /></span>
    {#if app.dmUnread}<span class="badge">{app.dmUnread}</span>{/if}
  </button>
  <div class="sep"></div>
  {#each app.realGroups as g (g.id)}
    {@const n = app.groupUnread(g.id)}
    <button type="button" class="item" class:active={app.groupId === g.id} class:unread={n > 0} onclick={() => app.openGroup(g.id)} title={g.name}>
      <span class="pill"></span>
      <Avatar id={g.id} name={g.name ?? '?'} url={g.icon_url} size={46} radius={app.groupId === g.id ? '16px' : '50%'} />
      {#if n}<span class="badge">{n > 99 ? '99+' : n}</span>{/if}
    </button>
  {/each}
  <button type="button" class="item add" onclick={() => ui.open({ type: 'create-group' })} title="Создать группу">
    <span class="home"><Icon name="plus" size={22} /></span>
  </button>
  <div class="grow"></div>
  <button type="button" class="item" onclick={() => ui.open({ type: 'settings' })} title="Настройки">
    {#if app.me}<Avatar id={app.me.id} name={app.me.display_name} url={app.me.avatar_url} crop={app.me.profile?.avatarCrop} size={40} />{/if}
    <span class="dot" class:off={!app.online} title={app.online ? 'В сети' : 'Нет связи'}></span>
  </button>
</nav>

<style>
  .rail {
    width: 72px; flex: none; height: 100%; display: flex; flex-direction: column; align-items: center; gap: 8px;
    padding: 12px 0 calc(12px + env(safe-area-inset-bottom)); background: var(--bg-sunken); scrollbar-width: none;
  }
  .item { position: relative; display: grid; place-items: center; width: 72px; }
  .item :global(.av) { transition: border-radius .2s; }
  @media (hover: hover) {
    .item:hover :global(.av) { border-radius: 16px !important; }
    .item:hover .home { border-radius: 16px; background: var(--accent); color: #fff; }
    .add:hover .home { background: var(--success); color: #fff; }
    .item:hover .pill { height: 20px; }
  }
  .home {
    width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center;
    background: var(--bg-elev); color: var(--text-muted); transition: border-radius .2s, background .2s, color .2s;
  }
  .item.active .home { border-radius: 16px; background: var(--accent); color: #fff; }
  .item .home.brand { overflow: hidden; border-radius: 12px; background: none; }
  .item.active .home.brand { outline: 1px solid var(--accent); outline-offset: 2px; }
  .add .home { color: var(--success); }
  .pill {
    position: absolute; left: 0; width: 4px; height: 0; border-radius: 0 4px 4px 0; background: var(--text); transition: height .2s;
  }
  .item.unread .pill { height: 8px; }
  .item.active .pill { height: 36px; }
  .badge { position: absolute; right: 10px; bottom: -2px; border: 3px solid var(--bg-sunken); box-sizing: content-box; }
  .sep { width: 32px; height: 2px; border-radius: 1px; background: var(--border); flex: none; }
  .grow { flex: 1; }
  .dot { position: absolute; right: 14px; bottom: 0; width: 12px; height: 12px; border-radius: 50%; background: var(--success); border: 3px solid var(--bg-sunken); }
  .dot.off { background: var(--text-faint); }
</style>
