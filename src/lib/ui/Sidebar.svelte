<script lang="ts">
  import { app } from '../state/app.svelte';
  import { ui } from '../state/ui.svelte';
  import Avatar from './Avatar.svelte';
  import PresenceLabel from './PresenceLabel.svelte';
  import Icon from './Icon.svelte';
  import { messageSummary, shortTime } from '../util/format';
  import type { Message } from '../api';

  function preview(m: Message | undefined, groupId: string) {
    if (!m) return 'Нет сообщений';
    if (m.deleted_at) return 'Сообщение удалено';
    const who = m.author_id === app.meId ? 'Вы: ' : app.groups.find((g) => g.id === groupId)?.kind === 'group' ? `${app.nameOf(m.author_id, groupId)}: ` : '';
    return who + messageSummary(m);
  }
</script>

<aside class="side">
  {#if app.groupId === null}
    <header>
      <h2>Личные</h2>
      <button type="button" class="icon-btn" onclick={() => ui.open({ type: 'new-dm' })} title="Новый чат" aria-label="Новый чат"><Icon name="edit" size={18} /></button>
    </header>
    <div class="list scroll">
      {#each app.dms as g (g.id)}
        {@const p = app.dmPartner(g)}
        {@const ch = app.channelsOf(g.id)[0]}
        {@const last = ch ? app.last[ch.id] : undefined}
        {@const n = app.groupUnread(g.id)}
        <button type="button" class="row" class:active={ch && app.channelId === ch.id} onclick={() => ch && app.openChannel(ch.id)}>
          <span class="person-avatar">
            <Avatar id={p?.id ?? g.id} name={p?.display_name ?? '?'} url={p?.avatar_url} crop={p?.profile?.avatarCrop} size={44} />
            {#if p}<span class="presence"><PresenceLabel userId={p.id} compact /></span>{/if}
          </span>
          <div class="meta">
            <div class="top"><b>{app.groupTitle(g)}</b>{#if last}<span class="time">{shortTime(last.created_at)}</span>{/if}</div>
            <div class="bottom"><span class="prev">{preview(last, g.id)}</span>{#if n}<span class="badge">{n}</span>{/if}</div>
          </div>
        </button>
      {:else}
        <div class="placeholder">
          <p class="muted">Пока нет личных чатов.</p>
          <button type="button" class="btn ghost" onclick={() => ui.open({ type: 'new-dm' })}><Icon name="plus" size={18} /> Написать другу</button>
        </div>
      {/each}
    </div>
  {:else if app.currentGroup}
    {@const g = app.currentGroup}
    <header>
      <button type="button" class="title" onclick={() => ui.open({ type: 'group-info', groupId: g.id })}>
        <h2>{g.name}</h2>
        <span class="muted small">{app.membersOf(g.id).length} участн.</span>
      </button>
      <button type="button" class="icon-btn" onclick={() => ui.open({ type: 'group-info', groupId: g.id })} aria-label="Настройки группы"><Icon name="users" size={18} /></button>
    </header>
    <div class="list scroll">
      <div class="section">Текстовые каналы</div>
      {#each app.channelsOf(g.id).filter((c) => c.kind === 'text') as c (c.id)}
        {@const n = app.unread[c.id] ?? 0}
        {@const last = app.last[c.id]}
        <button type="button" class="chan" class:active={app.channelId === c.id} class:unread={n > 0} onclick={() => app.openChannel(c.id)}>
          <Icon name="hash" size={18} />
          <span class="cname">{c.name}</span>
          {#if n}<span class="badge">{n}</span>{:else if last}<span class="time">{shortTime(last.created_at)}</span>{/if}
        </button>
      {/each}
      <div class="section">Голосовые каналы</div>
      {#each app.channelsOf(g.id).filter((c) => c.kind === 'voice') as c (c.id)}
        <button type="button" class="chan voice" disabled title="Голосовые каналы появятся на этапе звонков">
          <Icon name="volume" size={18} />
          <span class="cname">{c.name}</span>
          <span class="soon">скоро</span>
        </button>
      {/each}
    </div>
  {/if}
</aside>

<style>
  .person-avatar { position: relative; flex: none; }
  .presence { position: absolute; bottom: 0; right: 0; line-height: 1; }
  .side { width: 280px; flex: none; height: 100%; display: flex; flex-direction: column; background: var(--bg); border-right: 1px solid var(--border); }
  header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 14px 12px 10px 18px; min-height: 60px; padding-top: calc(14px + env(safe-area-inset-top)); }
  h2 { margin: 0; font-size: 18px; letter-spacing: -.01em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .title { text-align: left; min-width: 0; display: flex; flex-direction: column; }
  .small { font-size: 12px; }
  .list { flex: 1; padding: 4px 8px calc(12px + env(safe-area-inset-bottom)); }
  .row { width: 100%; display: flex; gap: 12px; align-items: center; padding: 8px 10px; border-radius: 14px; text-align: left; }
  .row:hover { background: var(--bg-hover); }
  .row.active { background: var(--bg-active); }
  .meta { flex: 1; min-width: 0; }
  .top, .bottom { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  .top b { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .time { font-size: 12px; color: var(--text-faint); flex: none; }
  .prev { font-size: 13.5px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .section { font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--text-faint); padding: 16px 10px 6px; }
  .chan { width: 100%; display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 10px; color: var(--text-muted); text-align: left; }
  .chan:hover:not(:disabled) { background: var(--bg-hover); color: var(--text); }
  .chan.active { background: var(--bg-active); color: var(--text); }
  .chan.unread { color: var(--text); font-weight: 600; }
  .chan:disabled { cursor: default; opacity: .6; }
  .cname { flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .soon { font-size: 11px; padding: 2px 6px; border-radius: 6px; background: var(--bg-hover); }
  .placeholder { text-align: center; padding: 32px 12px; }
  @media (max-width: 760px) {
    .side { width: auto; flex: 1; border-right: 0; }
  }
</style>
