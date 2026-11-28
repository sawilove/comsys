<script lang="ts">
  import { app } from '../state/app.svelte';
  import { ui } from '../state/ui.svelte';
  import type { Message, Attachment } from '../api/types';
  import Modal from './Modal.svelte';
  import VideoPlayer from './VideoPlayer.svelte';

  let { message, attachment }: { message: Message; attachment: Attachment } = $props();
  let url = $state('');
  let failed = $state(false);
  let reload = $state(0);
  let zoom = $state(1);
  const video = $derived(attachment.mime.startsWith('video/'));
  $effect(() => {
    void reload;
    let mounted = true;
    failed = false;
    url = '';
    zoom = 1;
    void app.mediaUrl(message, attachment).then((value) => {
      if (mounted) url = value;
    }).catch(() => { if (mounted) failed = true; });
    return () => { mounted = false; };
  });
</script>

<Modal title={video ? 'Видео' : 'Фото'} width={960} onclose={() => ui.close()}>
  <div class="viewer">
    {#if failed}
      <p>Не удалось открыть вложение</p>
      <button class="btn ghost" type="button" onclick={() => { reload++; }}>Повторить</button>
    {:else if url && video}
      <VideoPlayer src={url} onerror={() => { failed = true; }} />
    {:else if url}
      <div class="photo" class:zoomed={zoom > 1}>
        <img src={url} alt="Фото из чата" style:width={zoom * 100 + '%'} style:height={zoom * 100 + '%'}
          onerror={() => { failed = true; }} />
      </div>
    {:else}
      <p class="muted" role="status">Загрузка…</p>
    {/if}
  </div>
  {#if url && !video && !failed}
    <div class="zoom-controls" role="group" aria-label="Масштаб фото">
      <button type="button" class="icon-btn" aria-label="Уменьшить фото" disabled={zoom <= 1} onclick={() => { zoom -= .5; }}>−</button>
      <button type="button" class="btn ghost" aria-label="Сбросить масштаб" onclick={() => { zoom = 1; }}>{zoom * 100}%</button>
      <button type="button" class="icon-btn" aria-label="Увеличить фото" disabled={zoom >= 3} onclick={() => { zoom += .5; }}>+</button>
    </div>
  {/if}
  {#if message.body}<p class="caption">{message.body}</p>{/if}
</Modal>

<style>
  .viewer { display: grid; justify-items: center; gap: 8px; min-height: 90px; align-content: center; overflow: auto; border-radius: 12px; background: var(--bg-sunken); }
  .photo { width: 100%; height: min(60dvh, 575px); overflow: auto; overscroll-behavior: contain; }
  .photo img { display: block; object-fit: contain; }
  .photo.zoomed img { max-width: none; }
  .zoom-controls { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 8px; }
  .zoom-controls .icon-btn { font-size: 22px; }
  .caption { margin: 10px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
