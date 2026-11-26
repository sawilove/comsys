<script lang="ts">
  import { onDestroy } from 'svelte';
  import { app } from '../state/app.svelte';
  import type { Attachment, Message } from '../api';
  import Icon from './Icon.svelte';
  import { duration } from '../util/format';

  let { message, att, mine }: { message: Message; att: Attachment; mine: boolean } = $props();

  let audio: HTMLAudioElement | null = null;
  let playing = $state(false);
  let loading = $state(false);
  let progress = $state(0); // 0..1
  let rate = $state(1);
  let error = $state('');
  const total = $derived(att.duration_ms ?? 0);
  const bars = $derived(att.waveform?.length ? att.waveform : Array(40).fill(20));

  // Играет одно голосовое за раз.
  const ALL = ((globalThis as any).__comsysVoice ??= new Set<() => void>()) as Set<() => void>;
  const stopMe = () => audio?.pause();
  ALL.add(stopMe);
  onDestroy(() => {
    ALL.delete(stopMe);
    audio?.pause();
  });

  async function ensure() {
    if (audio) return audio;
    loading = true;
    try {
      const url = await app.mediaUrl(message, att);
      const a = new Audio();
      a.preload = 'auto';
      a.src = url;
      a.playbackRate = rate;
      a.ontimeupdate = () => {
        const d = isFinite(a.duration) && a.duration > 0 ? a.duration * 1000 : total;
        progress = d ? Math.min(1, (a.currentTime * 1000) / d) : 0;
      };
      a.onplay = () => (playing = true);
      a.onpause = () => (playing = false);
      a.onended = () => {
        playing = false;
        progress = 0;
      };
      a.onerror = () => (error = 'Не удалось загрузить');
      audio = a;
      return a;
    } catch (e) {
      error = (e as Error).message || 'Нет доступа к файлу';
      return null;
    } finally {
      loading = false;
    }
  }

  async function toggle(e: Event) {
    e.stopPropagation();
    const a = await ensure();
    if (!a) return;
    if (a.paused) {
      ALL.forEach((f) => f !== stopMe && f());
      await a.play().catch(() => (error = 'Формат не поддерживается'));
    } else a.pause();
  }

  async function seek(e: MouseEvent) {
    e.stopPropagation();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const a = await ensure();
    if (!a) return;
    const d = isFinite(a.duration) && a.duration > 0 ? a.duration : total / 1000;
    a.currentTime = frac * d;
    progress = frac;
  }

  function cycleRate(e: Event) {
    e.stopPropagation();
    rate = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    if (audio) audio.playbackRate = rate;
  }
</script>

<div class="vp" class:mine>
  <button type="button" class="play" onclick={toggle} aria-label={playing ? 'Пауза' : 'Слушать'} disabled={loading}>
    {#if loading}<span class="spin"></span>{:else}<Icon name={playing ? 'pause' : 'play'} size={18} />{/if}
  </button>
  <div class="body">
    <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
    <div class="wave" onclick={seek}>
      {#each bars as h, i}
        <span class:on={i / bars.length < progress} style="height:{Math.max(12, h)}%"></span>
      {/each}
    </div>
    <div class="info">
      <span>{error || duration(progress > 0 ? progress * total : total)}</span>
      <button type="button" class="rate" onclick={cycleRate}>{rate}×</button>
    </div>
  </div>
</div>

<style>
  .vp { display: flex; align-items: center; gap: 10px; white-space: normal; }
  .play {
    width: 40px; height: 40px; border-radius: 50%; flex: none; display: grid; place-items: center;
    background: var(--accent); color: #fff;
  }
  .mine .play { background: rgba(255,255,255,.95); color: var(--bubble-me); }
  .body { flex: 1; min-width: 0; }
  .wave { display: flex; align-items: center; gap: 2px; height: 28px; cursor: pointer; }
  .wave span { flex: 1; min-width: 2px; border-radius: 2px; background: currentColor; opacity: .35; transition: opacity .1s; }
  .wave span.on { opacity: 1; }
  .info { display: flex; gap: 8px; align-items: center; font-size: 11.5px; opacity: .8; margin-top: 2px; }
  .rate { font-size: 11px; font-weight: 700; padding: 1px 6px; border-radius: 6px; background: rgba(127,127,127,.2); }
  .spin { width: 16px; height: 16px; border-radius: 50%; border: 2px solid currentColor; border-right-color: transparent; animation: s 0.7s linear infinite; }
  @keyframes s { to { transform: rotate(360deg); } }
</style>
