<script lang="ts">
  import { untrack } from 'svelte';
  import { clamp, defaultCrop, maxCropZoom, type ProfileCrop, type ProfileImageKind } from '../util/profile';
  import ProfileImage from './ProfileImage.svelte';

  let { kind, reference, initial, onapply, oncancel }: {
    kind: ProfileImageKind; reference: string; initial: ProfileCrop;
    onapply: (crop: ProfileCrop) => void; oncancel: () => void;
  } = $props();
  let edit = $state(untrack(() => ({ ...initial })));
  let frame = $state<HTMLDivElement>();
  let imageSize = $state<{ width: number; height: number }>();
  let failed = $state(false);
  let drag: { pointer: number; x: number; y: number; start: ProfileCrop; travelX: number; travelY: number } | null = null;
  const fingers = new Map<number, { x: number; y: number }>();
  let pinch: { distance: number; zoom: number } | null = null;

  function pinchDistance() {
    const [first, second] = fingers.values();
    return first && second ? Math.hypot(first.x - second.x, first.y - second.y) : 0;
  }

  function start(event: PointerEvent) {
    if (!frame || !imageSize || event.button !== 0 || fingers.size >= 2) return;
    if (event.pointerType === 'touch') {
      fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      frame.setPointerCapture(event.pointerId);
      if (fingers.size === 2) {
        pinch = { distance: Math.max(1, pinchDistance()), zoom: edit.zoom };
        drag = null;
        return;
      }
    }
    const { width, height } = frame.getBoundingClientRect();
    const scale = Math.max(width / imageSize.width, height / imageSize.height) * edit.zoom;
    drag = {
      pointer: event.pointerId, x: event.clientX, y: event.clientY, start: { ...edit },
      travelX: imageSize.width * scale - width, travelY: imageSize.height * scale - height,
    };
    frame.setPointerCapture(event.pointerId);
  }

  function move(event: PointerEvent) {
    if (fingers.has(event.pointerId)) {
      fingers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinch && fingers.size === 2) {
        edit.zoom = clamp(pinch.zoom * pinchDistance() / pinch.distance, 1, maxCropZoom);
        return;
      }
    }
    if (!drag || drag.pointer !== event.pointerId) return;
    if (drag.travelX > 1) edit.x = clamp(drag.start.x - (event.clientX - drag.x) * 100 / drag.travelX, 0, 100);
    if (drag.travelY > 1) edit.y = clamp(drag.start.y - (event.clientY - drag.y) * 100 / drag.travelY, 0, 100);
  }

  function release(event: PointerEvent) {
    fingers.delete(event.pointerId);
    pinch = null;
    if (drag?.pointer === event.pointerId) drag = null;
  }
</script>

<section class="crop-editor" aria-label={kind === 'avatar' ? 'Кадрирование аватара' : 'Кадрирование баннера'}>
  <div class="header">
    <strong>{kind === 'avatar' ? 'Кадрирование аватара' : 'Кадрирование баннера'}</strong>
    <button class="reset" type="button" onclick={() => { edit = { ...defaultCrop }; }}>Сбросить</button>
  </div>
  <div class="stage">
    <div role="presentation" class="frame" class:round={kind === 'avatar'} bind:this={frame} onpointerdown={start} onpointermove={move}
      onlostpointercapture={release}>
      <ProfileImage {reference} crop={edit} onload={(size) => { imageSize = size; }} onfailure={() => { failed = true; }} />
      <span class="grid" aria-hidden="true"></span>
    </div>
  </div>
  <p class="hint muted">Перетащи изображение, чтобы выбрать кадр. На телефоне можно менять масштаб двумя пальцами.</p>
  {#if failed}<p class="error" role="alert">Не удалось открыть изображение.</p>{/if}
  <div class="controls">
    <label>Масштаб <output>{Math.round(edit.zoom * 100)}%</output><input type="range" min="1" max={maxCropZoom} step=".01" bind:value={edit.zoom} /></label>
    <label>По горизонтали<input type="range" min="0" max="100" step="1" bind:value={edit.x} /></label>
    <label>По вертикали<input type="range" min="0" max="100" step="1" bind:value={edit.y} /></label>
  </div>
  <div class="actions">
    <button type="button" class="btn" disabled={!imageSize || failed} onclick={() => onapply({ ...edit })}>Применить кадр</button>
    <button type="button" class="btn ghost" onclick={oncancel}>Отмена</button>
  </div>
</section>

<style>
  .crop-editor { display: grid; gap: 12px; padding: 12px; border: 1px solid var(--border); border-radius: 14px; background: var(--bg-elev); }
  .header, .actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .header { justify-content: space-between; }
  .reset { color: var(--text-muted); text-decoration: underline; font-size: 13px; }
  .hint { font-size: 12px; margin: 0; }
  .stage { display: grid; place-items: center; min-height: 130px; padding: 12px; border-radius: 10px; background: var(--bg-sunken); }
  .frame { position: relative; width: 100%; aspect-ratio: 7 / 2; overflow: hidden; touch-action: none; cursor: grab; outline: 1px solid var(--text-muted); background: var(--bg); user-select: none; }
  .frame:active { cursor: grabbing; }
  .frame.round { width: min(100%, 168px); aspect-ratio: 1; border-radius: 50%; }
  .grid { pointer-events: none; position: absolute; inset: 0; background: repeating-linear-gradient(90deg, transparent 0 calc(100% / 3 - 1px), #ffffff50 calc(100% / 3 - 1px) calc(100% / 3)), repeating-linear-gradient(transparent 0 calc(100% / 3 - 1px), #ffffff50 calc(100% / 3 - 1px) calc(100% / 3)); }
  .controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 14px; }
  label { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 4px; font-size: 13px; }
  label:first-child { grid-column: 1 / -1; }
  input { width: 100%; margin: 0; accent-color: var(--accent); }
</style>
