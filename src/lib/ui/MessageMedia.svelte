<script lang="ts">
  import { app } from '../state/app.svelte';
  import { ui } from '../state/ui.svelte';
  import Icon from './Icon.svelte';
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
{:else if url}
  <button class="preview" type="button" aria-label={video ? 'Открыть видео' : 'Открыть фото'}
    onclick={() => ui.open({ type: 'media', message, attachment })}>
    {#if video}
      <!-- svelte-ignore a11y_media_has_caption (превью пользовательского вложения) -->
      <video src={url} muted playsinline preload="metadata" aria-hidden="true"></video>
      <span class="play"><Icon name="play" size={25} /></span>
    {:else}
      <img src={url} alt="" loading="lazy" onerror={() => { failed = true; }} />
    {/if}
  </button>
{:else}
  <span class="muted">Загрузка вложения…</span>
{/if}

<style>
  .preview { display: block; position: relative; max-width: 100%; margin-inline: auto; overflow: hidden; border-radius: 14px; background: var(--bg-sunken); }
  img, video { display: block; max-width: 100%; max-height: 360px; object-fit: contain; }
  video { pointer-events: none; width: min(360px, 58vw); aspect-ratio: 16/9; }
  .play { position: absolute; inset: 50% auto auto 50%; transform: translate(-50%, -50%); display: grid; place-items: center; width: 48px; height: 48px; border-radius: 50%; background: #161321bc; color: white; }
  .retry { text-decoration: underline; }
</style>
