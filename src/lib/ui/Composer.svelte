<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { app } from '../state/app.svelte';
  import { ui } from '../state/ui.svelte';
  import type { Message } from '../api';
  import Icon from './Icon.svelte';
  import EmojiMenu from './EmojiMenu.svelte';
  import { VoiceRecorder, canRecord, MAX_VOICE_MS } from '../media/recorder';
  import { describeError, duration, messageSummary } from '../util/format';

  let { replyTo = $bindable(), editing = $bindable() }: { replyTo: Message | null; editing: Message | null } = $props();

  let text = $state('');
  let ta = $state<HTMLTextAreaElement>();
  let picker = $state<HTMLInputElement>();
  let media = $state<{ file: File; url: string } | null>(null);
  let sendingMedia = $state(false);
  let emojis = $state(false);
  let composer = $state<HTMLDivElement>();
  const accepted = 'image/jpeg,image/png,image/webp,image/gif,image/avif,video/mp4,video/webm,video/quicktime';
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
    if ((!body && !media) || sendingMedia) return;
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
    if (media) {
      sendingMedia = true;
      try {
        await app.sendMedia(media.file, body, reply);
        clearMedia();
      } catch (error) {
        ui.say(describeError(error));
        return;
      } finally {
        sendingMedia = false;
      }
    } else {
      await app.sendText(body, reply);
    }
    text = '';
    replyTo = null;
    saveDraft();
    ta?.focus();
  }

  function chooseMedia(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (!accepted.split(',').includes(file.type) || !file.size || file.size > 25 * 1024 * 1024) {
      ui.say('Выбери фото или видео в поддерживаемом формате до 25 МБ');
      return;
    }
    clearMedia();
    media = { file, url: URL.createObjectURL(file) };
  }

  function clearMedia() {
    if (media) URL.revokeObjectURL(media.url);
    media = null;
  }

  async function addEmoji(emoji: string) {
    const start = ta?.selectionStart ?? text.length;
    const end = ta?.selectionEnd ?? start;
    if (text.length - (end - start) + emoji.length > 4000) return;
    text = text.slice(0, start) + emoji + text.slice(end);
    emojis = false;
    saveDraft();
    await tick();
    ta?.focus();
    ta?.setSelectionRange(start + emoji.length, start + emoji.length);
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

  onDestroy(() => { rec?.cancel(); clearMedia(); });
</script>

<svelte:window onpointerdown={(event) => {
  if (emojis && event.target instanceof Node && !composer?.contains(event.target)) emojis = false;
}} onkeydown={(event) => { if (event.key === 'Escape') emojis = false; }} />
<div class="composer" bind:this={composer}>
  {#if emojis && !recording}<EmojiMenu onpick={(emoji) => { void addEmoji(emoji); }} />{/if}
  {#if replyTo || editing}
    <div class="ctx">
      <Icon name={editing ? 'edit' : 'reply'} size={18} />
      <div class="ctx-t">
        <b>{editing ? 'Редактирование' : `Ответ ${app.nameOf(replyTo!.author_id, replyTo!.group_id)}`}</b>
        <span>{messageSummary((editing ?? replyTo)!)}</span>
      </div>
      <button type="button" class="icon-btn" onclick={() => { replyTo = null; if (editing) { editing = null; text = ''; } }} aria-label="Отмена"><Icon name="x" size={18} /></button>
    </div>
  {/if}
  {#if media}
    <div class="ctx attachment">
      {#if media.file.type.startsWith('image/')}<img src={media.url} alt="" />
      {:else}
        <!-- svelte-ignore a11y_media_has_caption (превью пользовательского файла) -->
        <video src={media.url} muted playsinline preload="metadata" aria-label="Предпросмотр видео"></video>
      {/if}
      <div class="ctx-t"><b>{media.file.type.startsWith('image/') ? 'Фото' : 'Видео'}</b><span>{media.file.name}</span></div>
      <button type="button" class="icon-btn" disabled={sendingMedia} onclick={clearMedia} aria-label="Убрать вложение"><Icon name="x" size={18} /></button>
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
      {#if !editing}
        <input type="file" hidden accept={accepted} bind:this={picker} onchange={chooseMedia} />
        <button type="button" class="icon-btn attach" aria-label="Прикрепить фото или видео" title="Прикрепить фото или видео" disabled={sendingMedia} onclick={() => picker?.click()}>
          <Icon name="paperclip" size={22} />
        </button>
      {/if}
      <textarea
        bind:this={ta}
        bind:value={text}
        rows="1"
        placeholder={media ? 'Добавить подпись' : app.currentChannel?.name && app.currentGroup ? `Сообщение в #${app.currentChannel.name}` : 'Сообщение'}
        {onkeydown}
        oninput={saveDraft}
        maxlength="4000"
      ></textarea>
      <button type="button" class="icon-btn emoji-button" aria-label="Эмодзи" title="Эмодзи" aria-expanded={emojis}
        onclick={() => { emojis = !emojis; }}><Icon name="smile" size={21} /></button>
      {#if text.trim() || editing || media}
        <button type="button" class="send" disabled={sendingMedia} onclick={submit} aria-label="Отправить"><Icon name={editing ? 'check' : 'send'} size={20} /></button>
      {:else}
        <button type="button" class="send mic" onclick={startRec} aria-label="Записать голосовое" title="Записать голосовое"><Icon name="mic" size={20} /></button>
      {/if}
    {/if}
  </div>
</div>

<style>
  .composer { position: relative; flex: none; padding: 8px 16px calc(12px + env(safe-area-inset-bottom)); max-width: 920px; width: 100%; margin: 0 auto; }
  .ctx {
    display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 14px; margin-bottom: 6px;
    background: var(--bg-elev); border: 1px solid var(--border); border-radius: 14px; color: var(--accent);
  }
  .ctx-t { flex: 1; min-width: 0; display: flex; flex-direction: column; font-size: 13px; line-height: 1.3; }
  .ctx-t b { color: var(--accent); }
  .ctx-t span { color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .attachment img, .attachment video { width: 38px; height: 38px; border-radius: 8px; object-fit: cover; }
  .attach, .emoji-button { flex: none; height: 40px; }
  .emoji-button[aria-expanded="true"] { color: var(--accent); }
  .bar {
    display: flex; align-items: flex-end; gap: 8px; padding: 6px 6px 6px 16px; min-height: 52px;
    background: var(--bg-elev); border: 1px solid var(--border); border-radius: 26px; box-shadow: 0 2px 12px rgba(0,0,0,.12);
  }
  textarea {
    flex: 1; min-width: 0; resize: none; border: 0; outline: none; background: transparent; padding: 9px 0; max-height: 180px;
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
  @media (max-width: 760px) { .composer { padding-left: 10px; padding-right: 10px; } .bar { gap: 5px; padding-left: 6px; } .limit { display: none; } }
</style>
