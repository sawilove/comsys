<script lang="ts">
  import { app } from '../state/app.svelte';
  import type { Message, Attachment } from '../api';
  let { message, attachment }: { message: Message; attachment: Attachment } = $props();
  let url = $state('');
  let failed = $state(false);
  let retry = $state(0);
  const video = $derived(attachment.mime.startsWith('video/'));

  $effect(() => {
    void retry;
    const current = message;
    const file = attachment;
    let active = true;
    failed = false;
    void app.mediaUrl(current, file).then((source) => {
      if (active) url = source;
    }).catch(() => { if (active) failed = true; });
    return () => { active = false; };
  });
</script>

{#if failed}
  <button class="retry" type="button" onclick={() => { retry++; }}>Загрузить вложение ещё раз</button>
{:else if url && video}
  <!-- svelte-ignore a11y_media_has_caption (пользовательское вложение без дорожки субтитров) -->
  <video src={url} controls playsinline preload="metadata" onerror={() => { failed = true; }} aria-label="Видео из чата"></video>
{:else if url}
  <a href={url} target="_blank" rel="noreferrer" aria-label="Открыть фото">
    <img src={url} alt="Фото из чата" loading="lazy" onerror={() => { failed = true; }} />
  </a>
{:else}
  <span class="muted">Загрузка вложения…</span>
{/if}

<style>
  img, video { display: block; max-width: 100%; max-height: 360px; border-radius: 10px; object-fit: contain; }
  a { display: block; }
  .retry { text-decoration: underline; }
</style>
