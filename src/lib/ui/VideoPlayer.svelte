<script lang="ts">
  import Icon from './Icon.svelte';
  import { duration } from '../util/format';

  let { src, onerror }: { src: string; onerror: () => void } = $props();
  let player: HTMLDivElement;
  let video: HTMLVideoElement;
  let current = $state(0);
  let length = $state(0);
  let paused = $state(true);
  let muted = $state(false);
  let rate = $state(1);
  const seekable = $derived(Number.isFinite(length) && length > 0);

  function togglePlayback() {
    if (video.paused) void video.play().catch(() => { if (video.error) onerror(); });
    else video.pause();
  }

  function fullscreen() {
    const iosVideo = video as HTMLVideoElement & { webkitEnterFullscreen?: () => void };
    if (document.fullscreenElement === player) void document.exitFullscreen();
    else if (player.requestFullscreen) void player.requestFullscreen().catch(() => iosVideo.webkitEnterFullscreen?.());
    else iosVideo.webkitEnterFullscreen?.();
  }
</script>

<div class="player" bind:this={player}>
  <!-- svelte-ignore a11y_media_has_caption (пользовательское видео) -->
  <video {src} playsinline preload="metadata" aria-label="Видео из чата" {onerror}
    bind:this={video} bind:currentTime={current} bind:duration={length} bind:paused bind:muted bind:playbackRate={rate}></video>
  <div class="controls">
    <button type="button" class="icon-btn" aria-label={paused ? 'Воспроизвести' : 'Пауза'} onclick={togglePlayback}>
      <Icon name={paused ? 'play' : 'pause'} size={18} />
    </button>
    <input type="range" min="0" max={seekable ? length : 0} step="any" disabled={!seekable}
      aria-label="Позиция видео" value={current} oninput={(event) => { current = event.currentTarget.valueAsNumber; }} />
    <span class="time">{duration(current * 1000)} / {duration(seekable ? length * 1000 : 0)}</span>
    <button type="button" class="icon-btn" aria-label={muted ? 'Включить звук' : 'Выключить звук'} onclick={() => { muted = !muted; }}>
      <Icon name={muted ? 'mute' : 'volume'} size={18} />
    </button>
    <select aria-label="Скорость видео" bind:value={rate}>
      <option value={0.5}>0,5×</option><option value={1}>1×</option><option value={1.5}>1,5×</option><option value={2}>2×</option>
    </select>
    <button type="button" class="icon-btn" aria-label="Переключить полноэкранный режим" onclick={fullscreen}>
      <Icon name="fullscreen" size={18} />
    </button>
  </div>
</div>

<style>
  .player { display: grid; width: 100%; background: #09090b; color: #fff; }
  video { display: block; width: 100%; max-height: 62dvh; object-fit: contain; min-height: 110px; }
  .player:fullscreen { grid-template-rows: minmax(0, 1fr) auto; }
  .player:fullscreen video { height: 100%; max-height: none; }
  .controls { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 6px; padding: 4px 8px; }
  .controls button { color: inherit; }
  input { flex: 1 1 80px; min-width: 0; accent-color: var(--accent); }
  .time { font-size: 12px; white-space: nowrap; font-variant-numeric: tabular-nums; }
  select { background: #242428; color: inherit; border: 0; border-radius: 6px; padding: 5px 2px; font: inherit; font-size: 13px; }
</style>
