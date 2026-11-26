<script lang="ts">
  import { onDestroy } from 'svelte';
  import { app } from '../state/app.svelte';
  import { ui } from '../state/ui.svelte';
  import type { Message } from '../api';
  import Icon from './Icon.svelte';
  import { VoiceRecorder, canRecord, MAX_VOICE_MS } from '../media/recorder';
  import { describeError, duration } from '../util/format';

  let { replyTo = $bindable(), editing = $bindable() }: { replyTo: Message | null; editing: Message | null } = $props();

  let text = $state('');
  let ta = $state<HTMLTextAreaElement>();
  let rec: VoiceRecorder | null = null;
  let recording = $state(false);
  let elapsed = $state(0);
  let levels = $state<number[]>([]);

  const isTouch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const draftKey = $derived(`comsys-draft-${app.channelId}`);

  // Черновик на канал.
  $effect(() => {
    try {
      text = localStorage.getItem(draftKey) ?? '';
    } catch {
      /* ignore */
    }
  });
  $effect(() => {
    if (editing) {
      text = editing.body;
      queueMicrotask(() => ta?.focus());
    }
  });
  $effect(() => {
    if (replyTo) queueMicrotask(() => ta?.focus());
  });

  function saveDraft() {
    try {
      if (!editing) localStorage.setItem(draftKey, text);
    } catch {
      /* ignore */
    }
  }

  function autosize() {
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 180) + 'px';
  }
  $effect(() => {
    void text;
    queueMicrotask(autosize);
  });

  async function submit() {
    const body = text.trim();
    if (!body) return;
    if (editing) {
      const id = editing.id;
      editing = null;
      text = '';
      try {
        await app.edit(id, body);
      } catch (e) {
        ui.say(describeError(e));
      }
      return;
    }
    const reply = replyTo?.id ?? null;
    text = '';
    replyTo = null;
    saveDraft();
    await app.sendText(body, reply);
    ta?.focus();
  }

  function onkeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey && !isTouch && !e.isComposing) {
      e.preventDefault();
      void submit();
    }
    if (e.key === 'Escape') {
      replyTo = null;
      if (editing) {
        editing = null;
        text = '';
      }
    }
  }

  async function startRec() {
    if (!canRecord()) return ui.say('Этот браузер не умеет записывать звук');
    rec = new VoiceRecorder();
    levels = [];
    elapsed = 0;
    rec.onLevel = (l, ms) => {
      elapsed = ms;
      levels = [...levels.slice(-59), l];
    };
    rec.onLimit = () => void stopRec(true);
    try {
      await rec.start();
      recording = true;
    } catch (e) {
      rec = null;
      ui.say((e as Error).name === 'NotAllowedError' ? 'Нет доступа к микрофону' : 'Не удалось включить микрофон');
    }
  }

  async function stopRec(send: boolean) {
    const r = rec;
    rec = null;
    recording = false;
    if (!r) return;
    if (!send) return r.cancel();
    const res = await r.stop();
    if (!res) return ui.say('Слишком короткое голосовое');
    await app.sendVoice(res.blob, res.mime, res.durationMs, res.waveform);
  }

  onDestroy(() => rec?.cancel());
</script>

<div class="composer">
  {#if replyTo || editing}
    <div class="ctx">
      <Icon name={editing ? 'edit' : 'reply'} size={18} />
      <div class="ctx-t">
        <b>{editing ? 'Редактирование' : `Ответ ${app.nameOf(replyTo!.author_id, replyTo!.group_id)}`}</b>
        <span>{(editing ?? replyTo)!.kind === 'voice' ? '🎤 Голосовое' : (editing ?? replyTo)!.body}</span>
      </div>
      <button type="button" class="icon-btn" onclick={() => { replyTo = null; if (editing) { editing = null; text = ''; } }} aria-label="Отмена"><Icon name="x" size={18} /></button>
    </div>
  {/if}

  <div class="bar">
    {#if recording}
      <button type="button" class="icon-btn danger" onclick={() => stopRec(false)} aria-label="Отменить запись"><Icon name="trash" size={20} /></button>
      <div class="rec">
        <span class="reddot"></span>
        <span class="time">{duration(elapsed)}</span>
        <div class="live">
          {#each levels as l}<span style="height:{Math.max(8, l * 100)}%"></span>{/each}
        </div>
        <span class="limit muted">до {duration(MAX_VOICE_MS)}</span>
      </div>
      <button type="button" class="send" onclick={() => stopRec(true)} aria-label="Отправить голосовое"><Icon name="send" size={20} /></button>
    {:else}
      <textarea
        bind:this={ta}
        bind:value={text}
        rows="1"
        placeholder={app.currentChannel?.name && app.currentGroup ? `Сообщение в #${app.currentChannel.name}` : 'Сообщение'}
        {onkeydown}
        oninput={saveDraft}
        maxlength="4000"
      ></textarea>
      {#if text.trim() || editing}
        <button type="button" class="send" onclick={submit} aria-label="Отправить"><Icon name={editing ? 'check' : 'send'} size={20} /></button>
      {:else}
        <button type="button" class="send mic" onclick={startRec} aria-label="Записать голосовое" title="Записать голосовое"><Icon name="mic" size={20} /></button>
      {/if}
    {/if}
  </div>
</div>

<style>
  .composer { flex: none; padding: 8px 16px calc(12px + env(safe-area-inset-bottom)); max-width: 920px; width: 100%; margin: 0 auto; }
  .ctx {
    display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 14px; margin-bottom: 6px;
    background: var(--bg-elev); border: 1px solid var(--border); border-radius: 14px; color: var(--accent);
  }
  .ctx-t { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: 13px; line-height: 1.3; }
  .ctx-t b { color: var(--accent); }
  .ctx-t span { color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bar {
    display: flex; align-items: flex-end; gap: 8px; padding: 6px 6px 6px 16px; min-height: 52px;
    background: var(--bg-elev); border: 1px solid var(--border); border-radius: 26px; box-shadow: 0 2px 12px rgba(0,0,0,.12);
  }
  textarea {
    flex: 1; resize: none; border: 0; outline: none; background: transparent; padding: 9px 0; max-height: 180px;
    line-height: 1.4; font-size: 15px;
  }
  textarea::placeholder { color: var(--text-faint); }
  .send {
    width: 40px; height: 40px; flex: none; border-radius: 50%; display: grid; place-items: center;
    background: var(--accent); color: var(--accent-text); transition: transform .1s, filter .15s;
  }
  .send:hover { filter: brightness(1.1); }
  .send:active { transform: scale(.92); }
  .mic { background: var(--bg-hover); color: var(--text-muted); }
  .mic:hover { background: var(--accent); color: #fff; }
  .danger { color: var(--danger); align-self: center; }
  .rec { flex: 1; min-width: 0; display: flex; align-items: center; gap: 10px; height: 40px; }
  .reddot { width: 10px; height: 10px; border-radius: 50%; background: var(--danger); animation: blink 1s infinite; flex: none; }
  .time { font-variant-numeric: tabular-nums; font-weight: 600; flex: none; }
  .live { flex: 1; display: flex; align-items: center; justify-content: flex-end; gap: 2px; height: 28px; overflow: hidden; }
  .live span { width: 3px; flex: none; border-radius: 2px; background: var(--accent); }
  .limit { font-size: 12px; flex: none; }
  @keyframes blink { 50% { opacity: .3; } }
  @media (max-width: 760px) { .composer { padding-left: 10px; padding-right: 10px; } .limit { display: none; } }
</style>
