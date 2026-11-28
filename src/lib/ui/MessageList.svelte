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
  const mobile = new MediaQuery('(hover: none), (max-width: 760px)');

  const list = $derived(app.messages[channelId] ?? []);
  const byId = $derived(new Map(list.map((m) => [m.id, m])));
  const active = $derived(selected ? byId.get(selected) : undefined);

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
        onselect={() => (selected = selected === m.id ? null : m.id)}
        onreply={() => { selected = null; onreply(m); }}
        onedit={() => { selected = null; onedit(m); }}
        onremove={() => { selected = null; void remove(m); }}
      />
      </div>
    {/each}
  </div>
</div>
{#if mobile.current && active && !active.deleted_at && !app.sendState[active.id]}
  <Modal title="Сообщение" onclose={() => { selected = null; }}>
    <p class="action-preview muted">{messageSummary(active)}</p>
    <div class="actions">
      <button type="button" onclick={() => { selected = null; onreply(active); }}><Icon name="reply" /> Ответить</button>
      {#if active.author_id === app.meId}
        {#if active.kind === 'text'}
          <button type="button" onclick={() => { selected = null; onedit(active); }}><Icon name="edit" /> Изменить</button>
        {/if}
        <button type="button" class="remove" onclick={() => { selected = null; void remove(active); }}><Icon name="trash" /> Удалить</button>
      {/if}
    </div>
  </Modal>
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
  @media (max-width: 760px) { .inner { padding-inline: 10px; overflow-x: clip; } }
</style>
