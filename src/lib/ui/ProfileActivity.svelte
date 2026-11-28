<script lang="ts">
  import { onMount } from 'svelte';
  import { api, type Message, type ProfileMessageCounts } from '../api';
  import { app } from '../state/app.svelte';
  import MessageMedia from './MessageMedia.svelte';
  import VoicePlayer from './VoicePlayer.svelte';

  let { channelId, userId }: { channelId: string; userId: string } = $props();
  let counts = $state<ProfileMessageCounts>();
  let attachments = $state<Message[]>([]);
  let more = $state(false);
  let busy = $state(false);
  let failed = $state(false);
  const pageSize = 12;
  let active = true;
  let offset = 0;

  onMount(() => {
    void load();
    return () => { active = false; };
  });

  async function load() {
    if (busy) return;
    busy = true;
    failed = false;
    try {
      const [totals, page] = await Promise.all([
        counts ?? api.profileMessageCounts(channelId, userId),
        api.profileAttachments(channelId, userId, offset, pageSize + 1),
      ]);
      if (!active) return;
      counts = totals;
      offset += Math.min(page.length, pageSize);
      attachments = [...attachments, ...page.slice(0, pageSize).filter((m) => !attachments.some((previous) => previous.id === m.id))];
      more = page.length > pageSize;
    } catch {
      if (active) failed = true;
    } finally {
      if (active) busy = false;
    }
  }
</script>

<section class="activity">
  <h3>В этом чате</h3>
  {#if counts}
    <dl>
      <div><dt>Текст</dt><dd>{counts.text}</dd></div>
      <div><dt>Голосовые</dt><dd>{counts.voice}</dd></div>
      <div><dt>Фото</dt><dd>{counts.photo}</dd></div>
      <div><dt>Видео</dt><dd>{counts.video}</dd></div>
    </dl>
  {/if}
  {#if attachments.length}
    <h4>Вложения</h4>
    <div class="attachments">
      {#each attachments as message (message.id)}
        {#each message.attachments as attachment (attachment.key)}
          {#if message.kind === 'voice'}
            <div class="voice"><VoicePlayer {message} att={attachment} mine={message.author_id === app.meId} /></div>
          {:else}
            <div class="media"><MessageMedia {message} {attachment} /></div>
          {/if}
        {/each}
      {/each}
    </div>
  {:else if counts && !failed}
    <p class="muted">Вложений пока нет</p>
  {/if}
  {#if busy}<p class="muted" role="status">Загрузка…</p>{/if}
  {#if failed}
    <p class="muted" role="status">Не удалось загрузить данные чата</p>
    <button type="button" class="btn ghost" onclick={load}>Повторить</button>
  {:else if more && !busy}
    <button type="button" class="btn ghost" onclick={load}>Показать ещё</button>
  {/if}
</section>

<style>
  .activity { margin-top: 18px; padding-top: 14px; border-top: 1px solid var(--border); }
  h3, h4 { margin: 0 0 8px; font-size: 14px; }
  dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(65px, 1fr)); gap: 8px; margin: 0 0 14px; }
  dl > div { display: flex; flex-direction: column-reverse; gap: 2px; padding: 8px 4px; text-align: center; border-radius: 8px; background: var(--bg-hover); }
  dt { font-size: 11px; color: var(--text-muted); }
  dd { margin: 0; font-weight: 700; }
  .attachments { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .media { min-width: 0; }
  .voice { grid-column: 1 / -1; }
  p, .btn { margin: 8px 0 0; }
</style>
