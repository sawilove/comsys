<script lang="ts">
  import { app } from '../state/app.svelte';
  import { ui } from '../state/ui.svelte';
  import { profileAccent } from '../util/profile';
  import type { Message } from '../api';
  import Avatar from './Avatar.svelte';
  import Icon from './Icon.svelte';
  import VoicePlayer from './VoicePlayer.svelte';
  import MessageMedia from './MessageMedia.svelte';
  import { colorFor, messageSummary, timeHM } from '../util/format';

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
  const read = $derived(mine ? app.readCount(m) : 0);
  let swipe = $state(0);
  let touch: { id: number; x: number; y: number; horizontal: boolean } | null = null;
  let suppressTap = false;

  function interactive(event: Event) {
    return event.target instanceof Element && !!event.target.closest('button,a,video,audio,input');
  }

  function startSwipe(event: PointerEvent) {
    if (mine || m.deleted_at || event.pointerType !== 'touch' || !event.isPrimary || interactive(event)) return;
    touch = { id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: false };
    suppressTap = false;
  }

  function moveSwipe(event: PointerEvent) {
    if (!touch || touch.id !== event.pointerId) return;
    const dx = event.clientX - touch.x;
    const dy = event.clientY - touch.y;
    if (!touch.horizontal) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { touch = null; return; }
      if (dx < 12 || dx < Math.abs(dy) * 1.3) return;
      touch.horizontal = true;
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    }
    swipe = Math.max(0, Math.min(72, dx * .8));
  }

  function endSwipe(event: PointerEvent) {
    if (touch?.id !== event.pointerId) return;
    const shouldReply = event.type === 'pointerup' && swipe >= 48;
    suppressTap = touch.horizontal;
    touch = null;
    swipe = 0;
    if (shouldReply) onreply();
  }
</script>

<div class="row" class:mine class:continued class:selected>
  {#if !mine && showAuthor}
    <div class="avcol">
      {#if !continued}
        <button type="button" disabled={!author} aria-label={'Открыть профиль ' + name}
          onclick={() => ui.open({ type: 'profile', userId: m.author_id })}>
          <Avatar id={m.author_id} name={name} url={author?.avatar_url} crop={author?.profile?.avatarCrop} color={author?.profile?.accent} size={34} />
        </button>
      {/if}
    </div>
  {/if}
  {#if swipe > 0}<span class="swipe-reply" class:ready={swipe >= 48} aria-hidden="true"><Icon name="reply" size={20} /></span>{/if}
  <div class="stack" style:transform={swipe ? `translateX(${swipe}px)` : undefined}>
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="bubble" class:voice={m.kind === 'voice'} class:deleted={m.deleted_at}
      onpointerdown={startSwipe} onpointermove={moveSwipe} onpointerup={endSwipe} onpointercancel={endSwipe}
      onclick={(event) => {
        if (suppressTap) { suppressTap = false; return; }
        if (!m.deleted_at && !sendSt && !interactive(event)) onselect();
      }}
      oncontextmenu={(event) => {
        if (!m.deleted_at && !sendSt && !interactive(event) && matchMedia('(hover: none)').matches) {
          event.preventDefault();
          if (!selected) onselect();
        }
      }}>
      {#if !mine && showAuthor && !continued}
        <div class="author" style:color={profileAccent(author?.profile?.accent) ?? colorFor(m.author_id)}>{name}</div>
      {/if}
      {#if reply}
        <div class="quote">
          <b>{app.nameOf(reply.author_id, m.group_id)}</b>
          <span>{messageSummary(reply)}</span>
        </div>
      {/if}
      {#if m.deleted_at}
        <i class="muted">Сообщение удалено</i>
      {:else if m.kind === 'voice' && m.attachments[0]}
        <VoicePlayer message={m} att={m.attachments[0]} {mine} />
      {:else}
        {#if m.kind === 'media' && m.attachments[0]}
          <MessageMedia message={m} attachment={m.attachments[0]} />
        {/if}
        <span class="text">{#each parts as p, i}{#if i % 2}<a href={p} target="_blank" rel="noopener noreferrer">{p}</a>{:else}{p}{/if}{/each}</span>
      {/if}
      <span class="meta">
        {#if m.edited_at && !m.deleted_at}<span>изм.</span>{/if}
        <span>{timeHM(m.created_at)}</span>
        {#if mine}
          {#if sendSt === 'sending'}<Icon name="clock" size={13} />{:else if sendSt === 'failed'}<span class="fail"><Icon name="alert" size={13} /></span>
          {:else}
            {@const label = read ? (showAuthor ? `Прочитали: ${read}` : 'Прочитано') : 'Отправлено'}
            <span class="delivery" class:read title={label} aria-label={label} role="img"><Icon name={read ? 'checks' : 'check'} size={15} stroke={2.5} /></span>
          {/if}
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
    <button type="button" class="icon-btn mobile-tools" onclick={onselect} aria-label="Действия с сообщением"><Icon name="more" size={18} /></button>
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
    touch-action: pan-y pinch-zoom;
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
  .delivery { display: inline-grid; }
  .delivery.read { filter: drop-shadow(0 0 3px currentColor); }
  .swipe-reply { position: absolute; inset: auto auto 5px 4px; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 50%; background: var(--bg-elev); color: var(--text-muted); }
  .swipe-reply.ready { background: var(--accent); color: var(--accent-text); }
  .failed { font-size: 12px; color: var(--danger); margin-top: 3px; }
  .failed button { color: var(--accent); font-weight: 600; font-size: 12px; }
  .tools {
    display: none; align-self: center; gap: 2px; padding: 2px; border-radius: 10px;
    background: var(--bg-elev); border: 1px solid var(--border); box-shadow: var(--shadow);
  }
  .tools .icon-btn { width: 30px; height: 30px; }
  @media (hover: hover) { .row:hover .tools { display: flex; } }
  .row.selected .tools { display: flex; }
  .mobile-tools { display: none; }
  @media (hover: none), (max-width: 760px) {
    .row .tools, .row.selected .tools, .row:hover .tools { display: none; }
    .mobile-tools { display: inline-grid; width: 40px; height: 40px; flex: none; align-self: center; }
    .row { gap: 4px; }
    .bubble.voice { min-width: min(250px, 65vw); }
  }
</style>
