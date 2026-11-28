<script lang="ts">
  import { app } from '../state/app.svelte';
  import { ui } from '../state/ui.svelte';
  import type { Message, Attachment } from '../api/types';
  import Modal from './Modal.svelte';

  let { message, attachment }: { message: Message; attachment: Attachment } = $props();
  let url = $state('');
  let failed = $state(false);
  let reload = $state(0);
  let zoom = $state(false);
  const video = $derived(attachment.mime.startsWith('video/'));
  $effect(() => {
    void reload;
    let mounted = true;
    failed = false;
    url = '';
    void app.mediaUrl(message, attachment).then((value) => {
      if (mounted) url = value;
    }).catch(() => { if (mounted) failed = true; });
    return () => { mounted = false; };
  });
</script>

<Modal title={video ? 'Видео' : 'Фото'} width={960} onclose={() => ui.close()}>
  <div class="viewer" class:zoom>
    {#if failed}
      <p>Не удалось открыть вложение</p>
      <button class="btn ghost" type="button" onclick={() => { reload++; }}>Повторить</button>
    {:else if url && video}
      <!-- svelte-ignore a11y_media_has_caption (пользовательское видео) -->
      <video src={url} controls playsinline preload="metadata" aria-label="Видео из чата" onerror={() => { failed = true; }}></video>
    {:else if url}
      <button class="photo" type="button" aria-label={zoom ? 'Уменьшить фото' : 'Увеличить фото'} aria-pressed={zoom}
        onclick={() => { zoom = !zoom; }}>
        <img src={url} alt="Фото из чата" onerror={() => { failed = true; }} />
      </button>
    {:else}
      <p class="muted" role="status">Загрузка…</p>
    {/if}
  </div>
  {#if message.body}<p class="caption">{message.body}</p>{/if}
</Modal>

<style>
  .viewer { display: grid; justify-items: center; gap: 8px; min-height: 90px; align-content: center; overflow: auto; border-radius: 12px; background: var(--bg-sunken); }
  img, video { display: block; max-width: 100%; max-height: 68dvh; object-fit: contain; }
  .photo { max-width: 100%; cursor: zoom-in; }
  .zoom { max-height: 68dvh; justify-items: start; }
  .zoom .photo { max-width: none; cursor: zoom-out; }
  .zoom img { max-width: none; max-height: none; }
  .caption { margin: 10px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
