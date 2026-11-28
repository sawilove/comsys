<script lang="ts">
  import { clamp, profileAccent } from '../util/profile';

  let { value, onchange }: { value: string; onchange: (value: string) => void } = $props();
  const swatches = ['#ff668a', '#fc9852', '#f5ca63', '#58c69b', '#55bce4', '#718eff', '#a77bf5', '#dcecf4'];
  let lastHue = $state(0);
  let entry = $state<string | null>(null);
  let invalid = $state(false);
  const hsv = $derived(toHsv(value, lastHue));

  function toHsv(hex: string, fallbackHue: number) {
    const rgb = Number.parseInt(hex.slice(1), 16);
    const r = (rgb >> 16) / 255;
    const g = ((rgb >> 8) & 255) / 255;
    const b = (rgb & 255) / 255;
    const brightness = Math.max(r, g, b);
    const delta = brightness - Math.min(r, g, b);
    let hue = fallbackHue;
    if (delta) {
      const sector = brightness === r ? (g - b) / delta : brightness === g ? 2 + (b - r) / delta : 4 + (r - g) / delta;
      hue = (sector * 60 + 360) % 360;
    }
    return { hue, saturation: brightness ? delta / brightness : 0, brightness };
  }

  function update(hue: number, saturation: number, brightness: number) {
    lastHue = hue;
    const channel = (offset: number) => {
      const k = (offset + hue / 60) % 6;
      const intensity = brightness * (1 - saturation * Math.max(0, Math.min(k, 4 - k, 1)));
      return Math.round(intensity * 255).toString(16).padStart(2, '0');
    };
    entry = null;
    invalid = false;
    onchange(`#${channel(5)}${channel(3)}${channel(1)}`);
  }

  function pick(event: PointerEvent) {
    const area = event.currentTarget as HTMLDivElement;
    const bounds = area.getBoundingClientRect();
    update(hsv.hue, clamp((event.clientX - bounds.left) / bounds.width, 0, 1),
      1 - clamp((event.clientY - bounds.top) / bounds.height, 0, 1));
  }

  function enter(text: string) {
    entry = text;
    const hex = profileAccent('#' + text.trim().replace(/^#/, ''));
    invalid = !hex;
    if (hex) onchange(hex.toLowerCase());
  }
</script>

<div class="palette" style:--hue={hsv.hue + 'deg'}>
  <div class="plane" role="presentation" onpointerdown={(event) => {
      if (!event.isPrimary || event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      pick(event);
    }} onpointermove={(event) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) pick(event);
    }}>
    <span class="cursor" style:left={100 * hsv.saturation + '%'} style:top={100 * (1 - hsv.brightness) + '%'} style:background={value}></span>
  </div>
  <label class="hue">Оттенок<input type="range" min="0" max="359" step="1" value={Math.round(hsv.hue) % 360}
    oninput={(event) => update(event.currentTarget.valueAsNumber, hsv.saturation || 1, hsv.brightness || 1)} /></label>
  <div class="values">
    <label>Насыщенность<input type="range" min="0" max="100" value={Math.round(hsv.saturation * 100)}
      oninput={(event) => update(hsv.hue, event.currentTarget.valueAsNumber / 100, hsv.brightness)} /></label>
    <label>Яркость<input type="range" min="0" max="100" value={Math.round(hsv.brightness * 100)}
      oninput={(event) => update(hsv.hue, hsv.saturation, event.currentTarget.valueAsNumber / 100)} /></label>
    <label>HEX
      <input class="input hex" spellcheck="false" maxlength="7" aria-invalid={invalid} value={entry ?? value.toUpperCase()}
        oninput={(event) => enter(event.currentTarget.value)} onblur={() => { entry = null; invalid = false; }}
        onkeydown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }} />
    </label>
  </div>
  <div class="swatches" aria-label="Готовые цвета" role="group">
    {#each swatches as color (color)}
      <button type="button" title={color} aria-label={'Выбрать цвет ' + color} aria-pressed={value.toLowerCase() === color}
        style:--swatch={color} onclick={() => { entry = null; invalid = false; onchange(color); }}></button>
    {/each}
  </div>
</div>

<style>
  .palette { display: grid; gap: 12px; padding: 12px; background: var(--bg-sunken); border: 1px solid var(--border); border-radius: 12px; }
  .plane { position: relative; height: 108px; border-radius: 9px; touch-action: none; cursor: crosshair; background: linear-gradient(transparent, #000), linear-gradient(90deg, #fff, hsl(var(--hue) 100% 50%)); }
  .cursor { position: absolute; width: 14px; height: 14px; border: 2px solid #fff; border-radius: 50%; box-shadow: 0 0 0 1px #000a; transform: translate(-50%, -50%); pointer-events: none; }
  label { display: grid; gap: 5px; color: var(--text-muted); font-size: 12px; }
  input[type="range"] { width: 100%; margin: 0; accent-color: var(--accent); }
  .hue input { appearance: none; height: 12px; border-radius: 10px; background: linear-gradient(90deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00); cursor: pointer; }
  .hue input::-webkit-slider-thumb { appearance: none; width: 17px; height: 17px; border: 2px solid #fff; border-radius: 50%; background: hsl(var(--hue) 100% 50%); box-shadow: 0 0 0 1px #000a; }
  .hue input::-moz-range-thumb { width: 13px; height: 13px; border: 2px solid #fff; border-radius: 50%; background: hsl(var(--hue) 100% 50%); }
  .values { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 74px; align-items: center; gap: 8px; }
  .hex { width: 100%; height: 34px; padding: 0 6px; font-family: monospace; }
  .hex[aria-invalid="true"] { border-color: var(--danger); }
  .swatches { display: flex; flex-wrap: wrap; gap: 6px; }
  .swatches button { width: 30px; height: 30px; border: 2px solid var(--bg-sunken); border-radius: 8px; background: var(--swatch); }
  .swatches button[aria-pressed="true"], .swatches button:focus-visible { outline: 2px solid var(--text); }
</style>
