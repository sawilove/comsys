<script lang="ts">
  import { app } from '../state/app.svelte';
  import { ui } from '../state/ui.svelte';
  import { profileAccent } from '../util/profile';
  import type { Message } from '../api';
  import Avatar from './Avatar.svelte';
  import Icon from './Icon.svelte';
  import VoicePlayer from './VoicePlayer.svelte';
  import { colorFor, timeHM } from '../util/format';

  let {
    m,
    mine,
    continued,
    showAuthor,
    reply,
    selected,
    onselect,
    onreply,
    onedit,
    onremove,
  }: {
    m: Message;
    mine: boolean;
    continued: boolean;
    showAuthor: boolean;
    reply: Message | undefined;
    selected: boolean;
    onselect: () => void;
    onreply: () => void;
    onedit: () => void;
    onremove: () => void;
  } = $props();

  const sendSt = $derived(app.sendState[m.id]);
  const author = $derived(app.profiles[m.author_id]);
  const name = $derived(app.nameOf(m.author_id, m.group_id));

  // Ссылки кликабельны, остальное как текст (без HTML).
  const parts = $derived(m.body.split(/(https?:\/\/[^\s<]+)/g));
</script>

<div class="row" class:mine class:continued class:selected>
  {#if !mine && showAuthor}
    <div class="avcol">
      {#if !continued}
        <button type="button" disabled={!author} aria-label={'Открыть профиль ' + name}
          onclick={() => ui.open({ type: 'profile', userId: m.author_id })}>
          <Avatar id={m.author_id} name={name} url={author?.avatar_url} color={author?.profile?.accent} size={34} />
        </button>
      {/if}
    </div>
  {/if}
  <div class="stack">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="bubble" class:voice={m.kind === 'voice'} class:deleted={m.deleted_at} onclick={onselect}>
      {#if !mine && showAuthor && !continued}
        <div class="author" style:color={profileAccent(author?.profile?.accent) ?? colorFor(m.author_id)}>{name}</div>
      {/if}
      {#if reply}
        <div class="quote">
          <b>{app.nameOf(reply.author_id, m.group_id)}</b>
          <span>{reply.deleted_at ? 'Сообщение удалено' : reply.kind === 'voice' ? '🎤 Голосовое' : reply.body}</span>
        </div>
      {/if}
      {#if m.deleted_at}
        <i class="muted">Сообщение удалено</i>
      {:else if m.kind === 'voice' && m.attachments[0]}
        <VoicePlayer message={m} att={m.attachments[0]} {mine} />
      {:else}
        <span class="text">{#each parts as p, i}{#if i % 2}<a href={p} target="_blank" rel="noopener noreferrer">{p}</a>{:else}{p}{/if}{/each}</span>
      {/if}
      <span class="meta">
        {#if m.edited_at && !m.deleted_at}<span>изм.</span>{/if}
        <span>{timeHM(m.created_at)}</span>
        {#if mine}
          {#if sendSt === 'sending'}<Icon name="clock" size={13} />{:else if sendSt === 'failed'}<span class="fail"><Icon name="alert" size={13} /></span>{:else}<Icon name="check" size={14} stroke={2.5} />{/if}
        {/if}
      </span>
    </div>
    {#if sendSt === 'failed'}
      <div class="failed">
        Не отправлено. <button type="button" onclick={() => app.retry(m.id)}>Повторить</button> · <button type="button" onclick={onremove}>Удалить</button>
      </div>
    {/if}
  </div>
  {#if !m.deleted_at && !sendSt}
    <div class="tools">
      <button type="button" class="icon-btn" onclick={onreply} title="Ответить" aria-label="Ответить"><Icon name="reply" size={16} /></button>
      {#if mine && m.kind === 'text'}<button type="button" class="icon-btn" onclick={onedit} title="Изменить" aria-label="Изменить"><Icon name="edit" size={16} /></button>{/if}
      {#if mine}<button type="button" class="icon-btn" onclick={onremove} title="Удалить" aria-label="Удалить"><Icon name="trash" size={16} /></button>{/if}
    </div>
  {/if}
</div>

<style>
  .row { display: flex; align-items: flex-end; gap: 8px; margin-top: 10px; position: relative; }
  .row.continued { margin-top: 2px; }
  .row.mine { flex-direction: row-reverse; }
  .avcol { width: 34px; flex: none; }
  .stack { display: flex; flex-direction: column; max-width: min(560px, 78%); }
  .mine .stack { align-items: flex-end; }
  .bubble {
    position: relative; padding: 7px 12px 6px; border-radius: var(--bubble-radius);
    background: var(--bubble-other); color: var(--bubble-other-text);
    box-shadow: 0 1px 1.5px rgba(0,0,0,.12); overflow-wrap: anywhere;
  }
  .mine .bubble { background: var(--bubble-me); color: var(--bubble-me-text); }
  .row:not(.mine):not(.continued) .bubble { border-bottom-left-radius: 6px; }
  .row.mine:not(.continued) .bubble { border-bottom-right-radius: 6px; }
  .bubble.voice { padding: 8px 12px 8px 8px; min-width: 250px; }
  .bubble.voice .meta { position: absolute; right: 12px; bottom: 8px; margin: 0; }
  .bubble.deleted { opacity: .7; }
  .author { font-size: 13px; font-weight: 700; margin-bottom: 1px; }
  .text { white-space: pre-wrap; }
  .text a { color: inherit; text-decoration: underline; }
  .quote {
    display: flex; flex-direction: column; font-size: 13px; line-height: 1.3; padding: 4px 8px; margin: 2px 0 4px;
    border-left: 3px solid currentColor; border-radius: 6px; background: rgba(127,127,127,.15); max-width: 100%;
  }
  .quote span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; opacity: .85; }
  .meta { float: right; display: inline-flex; align-items: center; gap: 3px; margin: 6px 0 -2px 10px; font-size: 11px; opacity: .7; line-height: 1; }
  .fail { color: var(--danger); display: inline-grid; }
  .mine .fail { color: #fff; }
  .failed { font-size: 12px; color: var(--danger); margin-top: 3px; }
  .failed button { color: var(--accent); font-weight: 600; font-size: 12px; }
  .tools {
    display: none; align-self: center; gap: 2px; padding: 2px; border-radius: 10px;
    background: var(--bg-elev); border: 1px solid var(--border); box-shadow: var(--shadow);
  }
  .tools .icon-btn { width: 30px; height: 30px; }
  @media (hover: hover) { .row:hover .tools { display: flex; } }
  .row.selected .tools { display: flex; }
</style>
