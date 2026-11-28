<script lang="ts">
  import { tick } from 'svelte';
  import { MediaQuery } from 'svelte/reactivity';
  import { app } from '../state/app.svelte';
  import { ui } from '../state/ui.svelte';
  import type { Message } from '../api';
  import MessageItem from './MessageItem.svelte';
  import Modal from './Modal.svelte';
  import Icon from './Icon.svelte';
  import { dayLabel, describeError, messageSummary } from '../util/format';

  let {
    channelId,
    groupKind,
    onreply,
    onedit,
  }: { channelId: string; groupKind: 'group' | 'dm'; onreply: (m: Message) => void; onedit: (m: Message) => void } = $props();

  let el: HTMLDivElement;
  let atBottom = true;
  let loadingOlder = false;
  let selected = $state<string | null>(null);
  let menu = $state<{ x: number; y: number } | null>(null);
  let menuElement = $state<HTMLDivElement>();
  const mobile = new MediaQuery('(hover: none), (max-width: 760px)');

  const list = $derived(app.messages[channelId] ?? []);
  const byId = $derived(new Map(list.map((m) => [m.id, m])));
  const active = $derived(selected ? byId.get(selected) : undefined);

  function closeActions() {
    selected = null;
    menu = null;
  }

  async function openContext(message: Message, x: number, y: number) {
    selected = message.id;
    menu = { x, y };
    await tick();
    if (!menuElement || !menu) return;
    menu = {
      x: Math.max(8, Math.min(x, innerWidth - menuElement.offsetWidth - 8)),
      y: Math.max(8, Math.min(y, innerHeight - menuElement.offsetHeight - 8)),
    };
    menuElement.querySelector('button')?.focus({ preventScroll: true });
  }

  function menuKeys(event: KeyboardEvent) {
    if (event.key === 'Escape') closeActions();
    if (!menuElement || !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const actions = [...menuElement.querySelectorAll('button')];
    const current = actions.indexOf(document.activeElement as HTMLButtonElement);
    actions[(current + (event.key === 'ArrowDown' ? 1 : -1) + actions.length) % actions.length]?.focus();
  }

  const observed = new Map<Element, Message>();
  const visible = new Set<Element>();
  let observer: IntersectionObserver | undefined;
  function reportVisible() {
    app.seeMessages([...visible].flatMap((node) => {
      const message = observed.get(node);
      return message ? [message] : [];
    }));
  }

  function observeRead(node: HTMLElement, message: Message) {
    if (!('IntersectionObserver' in window)) return;
    observer ??= new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.intersectionRect.height >= Math.min(48, entry.boundingClientRect.height)) visible.add(entry.target);
        else visible.delete(entry.target);
      }
      reportVisible();
    }, { threshold: [0, .15, .35, .6, 1] });
    observed.set(node, message);
    observer.observe(node);
    return {
      update(next: Message) { observed.set(node, next); },
      destroy() { observer?.unobserve(node); observed.delete(node); visible.delete(node); },
    };
  }

  function sameGroup(a: Message | undefined, b: Message) {
    if (!a || a.author_id !== b.author_id) return false;
    if (a.created_at.slice(0, 10) !== b.created_at.slice(0, 10)) return false;
    return Date.parse(b.created_at) - Date.parse(a.created_at) < 5 * 60 * 1000;
  }

  let lastLen = 0;
  let lastFirst: string | undefined;
  $effect(() => {
    const len = list.length;
    const first = list[0]?.id;
    const lastMine = list[len - 1]?.author_id === app.meId;
    const prepended = lastFirst !== undefined && first !== lastFirst && len > lastLen;
    const prevHeight = el?.scrollHeight ?? 0;
    const prevTop = el?.scrollTop ?? 0;
    void tick().then(() => {
      if (!el) return;
      if (prepended && !atBottom) el.scrollTop = prevTop + (el.scrollHeight - prevHeight);
      else if (atBottom || lastMine || lastLen === 0) el.scrollTop = el.scrollHeight;
    });
    lastLen = len;
    lastFirst = first;
  });

  async function onscroll() {
    if (menu) closeActions();
    atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (el.scrollTop < 120 && !loadingOlder && app.hasMore[channelId] !== false) {
      loadingOlder = true;
      await app.loadOlder(channelId);
      loadingOlder = false;
    }
  }

  async function remove(m: Message) {
    if (app.sendState[m.id]) return app.discard(m.id);
    if (!confirm('Удалить сообщение у всех?')) return;
    try {
      await app.remove(m.id);
    } catch (e) {
      ui.say(describeError(e));
    }
  }
</script>

<svelte:document onvisibilitychange={reportVisible} />
<svelte:window onpointerdown={(event) => {
  if (menu && event.target instanceof Node && !menuElement?.contains(event.target)) closeActions();
}} onkeydown={menuKeys} onresize={closeActions} />
<div class="list scroll" bind:this={el} {onscroll}>
  <div class="inner">
    {#if app.hasMore[channelId] === false || list.length === 0}
      <div class="start">
        <div class="emoji">👋</div>
        <b>Это начало чата</b>
        <span class="muted">Напиши что-нибудь или запиши голосовое</span>
      </div>
    {/if}
    {#each list as m, i (m.id)}
      {@const prev = list[i - 1]}
      {#if !prev || prev.created_at.slice(0, 10) !== m.created_at.slice(0, 10)}
        <div class="day"><span>{dayLabel(m.created_at)}</span></div>
      {/if}
      <div use:observeRead={m}>
      <MessageItem
        {m}
        mine={m.author_id === app.meId}
        continued={sameGroup(prev, m)}
        showAuthor={groupKind === 'group'}
        reply={m.reply_to ? byId.get(m.reply_to) : undefined}
        selected={selected === m.id}
        onselect={() => { if (selected === m.id) closeActions(); else selected = m.id; }}
        oncontext={(x, y) => { void openContext(m, x, y); }}
        onreply={() => { closeActions(); onreply(m); }}
        onremove={() => { closeActions(); void remove(m); }}
      />
      </div>
    {/each}
  </div>
</div>
{#snippet actions(message: Message)}
  <div class="actions">
    {#if message.kind === 'media' && message.attachments[0]}
      <button type="button" onclick={() => { closeActions(); ui.open({ type: 'media', message, attachment: message.attachments[0] }); }}><Icon name="play" size={17} /> Открыть вложение</button>
    {/if}
    <button type="button" onclick={() => { closeActions(); onreply(message); }}><Icon name="reply" size={17} /> Ответить</button>
    {#if message.author_id === app.meId}
      {#if message.kind === 'text'}
        <button type="button" onclick={() => { closeActions(); onedit(message); }}><Icon name="edit" size={17} /> Изменить</button>
      {/if}
      <button type="button" class="remove" onclick={() => { closeActions(); void remove(message); }}><Icon name="trash" size={17} /> Удалить</button>
    {/if}
  </div>
{/snippet}
{#if active && !active.deleted_at && !app.sendState[active.id]}
  {#if menu}
    <div class="context-menu" role="group" aria-label="Действия с сообщением" bind:this={menuElement} style:left={menu.x + 'px'} style:top={menu.y + 'px'}>
      {@render actions(active)}
    </div>
  {:else if mobile.current}
    <Modal title="Сообщение" onclose={closeActions}>
      <p class="action-preview muted">{messageSummary(active)}</p>
      {@render actions(active)}
    </Modal>
  {/if}
{/if}

<style>
  .list { flex: 1; min-height: 0; display: flex; flex-direction: column; }
  .inner { margin-top: auto; padding: 16px 16px 8px; display: flex; flex-direction: column; max-width: 920px; width: 100%; margin-left: auto; margin-right: auto; }
  .start { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 32px 0 24px; text-align: center; }
  .emoji { font-size: 40px; margin-bottom: 6px; }
  .day { display: flex; justify-content: center; margin: 14px 0 8px; position: sticky; top: 6px; z-index: 1; }
  .day span { font-size: 12px; font-weight: 600; padding: 4px 10px; border-radius: 10px; background: color-mix(in srgb, var(--bg-elev) 85%, transparent); color: var(--text-muted); backdrop-filter: blur(8px); border: 1px solid var(--border); }
  .action-preview { margin: 0 0 10px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .actions { display: grid; gap: 4px; }
  .actions button { display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 0 12px; text-align: left; border-radius: 10px; background: var(--bg-hover); }
  .actions .remove { color: var(--danger); }
  .context-menu { position: fixed; z-index: 40; min-width: 180px; padding: 5px; border: 1px solid var(--border); border-radius: 12px; background: var(--bg-elev); box-shadow: var(--shadow); }
  .context-menu .actions button { min-height: 36px; background: transparent; }
  .context-menu .actions button:hover, .context-menu .actions button:focus-visible { background: var(--bg-hover); }
  @media (max-width: 760px) { .inner { padding-inline: 10px; overflow-x: clip; } }
</style>
