<script lang="ts">
  import { gradientBackground, type ProfileGradient } from '../util/profile';
  import ProfilePalette from './ProfilePalette.svelte';

  let { accent = $bindable(), gradient = $bindable() }: { accent: string; gradient: ProfileGradient | null } = $props();
  let expanded = $state(false);
  let selected = $state(0);
  let previous = $state<ProfileGradient | null>(null);
  const presets = [
    { name: 'Сумерки', colors: ['#5058db', '#ae70f4', '#ed91b7'] },
    { name: 'Северное сияние', colors: ['#1b477c', '#3ca6aa', '#8cea9b'] },
    { name: 'Закат', colors: ['#82398c', '#ec6674', '#ffc276'] },
  ];
  const background = $derived(gradient ? gradientBackground(gradient) : accent);

  function setMode(enabled: boolean) {
    if (enabled && !gradient) {
      gradient = previous ?? { angle: 135, stops: [{ color: accent, position: 0 }, { color: '#ff86b8', position: 100 }] };
      accent = gradient.stops[0].color;
      selected = 0;
    } else if (!enabled && gradient) {
      previous = $state.snapshot(gradient);
      gradient = null;
    }
  }

  function changeColor(color: string) {
    if (gradient) {
      gradient.stops[selected].color = color;
      if (selected === 0) accent = color;
    } else {
      accent = color;
    }
  }

  function applyPreset(colors: string[]) {
    gradient = { angle: gradient?.angle ?? 135, stops: colors.map((color, index) => ({ color, position: index * 50 })) };
    accent = colors[0];
    selected = 0;
  }
</script>

<div class="accent">
  <button class="summary" type="button" aria-expanded={expanded} onclick={() => { expanded = !expanded; }}>
    <span class="chip" style:background={background}></span>
    <span class="value"><b>Акцент профиля</b><small>{gradient ? 'Градиент' : accent.toUpperCase()}</small></span>
    <span aria-hidden="true" class="chevron" class:open={expanded}></span>
  </button>
  {#if expanded}
    <div class="controls">
      <div class="modes" role="group" aria-label="Вид акцента">
        <button type="button" aria-pressed={!gradient} onclick={() => setMode(false)}>Один цвет</button>
        <button type="button" aria-pressed={!!gradient} onclick={() => setMode(true)}>Градиент</button>
      </div>
      {#if gradient}
        <div class="track" style:background={gradientBackground({ ...gradient, angle: 90 })}></div>
        <div class="stops" role="group" aria-label="Цвета градиента">
          {#each gradient.stops as stop, index (index)}
            <button class="stop" type="button" aria-pressed={index === selected} aria-label={'Цвет ' + (index + 1)}
              onclick={() => { selected = index; }}><span style:background={stop.color}></span>{stop.position}%</button>
          {/each}
          <button class="stop" type="button" disabled={gradient.stops.length === 4} onclick={() => {
            if (!gradient) return;
            gradient.stops.push({ color: accent, position: 50 });
            selected = gradient.stops.length - 1;
          }}>+ Цвет</button>
        </div>
        <div class="sliders">
          <label>Угол <output>{gradient.angle}°</output><input type="range" min="0" max="360" bind:value={gradient.angle} /></label>
          <label>Позиция цвета <output>{gradient.stops[selected].position}%</output><input type="range" min="0" max="100" bind:value={gradient.stops[selected].position} /></label>
        </div>
        {#key selected}<ProfilePalette value={gradient.stops[selected].color} onchange={changeColor} />{/key}
        <div class="bottom">
          {#each presets as preset (preset.name)}
            <button type="button" class="preset" onclick={() => applyPreset(preset.colors)}>{preset.name}</button>
          {/each}
          {#if gradient.stops.length > 2}
            <button class="remove" type="button" onclick={() => {
              if (!gradient) return;
              gradient.stops.splice(selected, 1);
              selected = Math.min(selected, gradient.stops.length - 1);
              accent = gradient.stops[0].color;
            }}>Убрать цвет</button>
          {/if}
        </div>
      {:else}
        <ProfilePalette value={accent} onchange={changeColor} />
      {/if}
    </div>
  {/if}
</div>

<style>
  .accent { border: 1px solid var(--border); border-radius: 12px; background: var(--bg-elev); }
  .summary { display: flex; align-items: center; gap: 10px; width: 100%; padding: 9px 12px; text-align: left; border-radius: 12px; }
  .summary:hover { background: var(--bg-hover); }
  .chip { width: 44px; height: 34px; border: 1px solid var(--border); border-radius: 8px; }
  .value { flex: 1; display: grid; font-size: 13px; }
  small { color: var(--text-muted); }
  .chevron { width: 8px; height: 8px; border: solid var(--text-muted); border-width: 0 1.5px 1.5px 0; transform: rotate(45deg); }
  .chevron.open { transform: rotate(225deg); }
  .controls { display: grid; gap: 10px; padding: 0 10px 10px; }
  .modes { display: grid; grid-template-columns: 1fr 1fr; padding: 3px; border-radius: 10px; background: var(--bg-sunken); }
  .modes button { padding: 6px; border-radius: 8px; font-size: 13px; }
  .modes button[aria-pressed="true"], .stop[aria-pressed="true"] { background: var(--bg-active); }
  .track { height: 20px; border-radius: 6px; }
  .stops, .bottom { display: flex; flex-wrap: wrap; gap: 5px; }
  .stop, .preset, .remove { display: inline-flex; align-items: center; gap: 5px; padding: 5px 7px; border-radius: 7px; border: 1px solid var(--border); font-size: 12px; }
  .stop:disabled { opacity: .45; }
  .stop span { width: 13px; height: 13px; border-radius: 4px; }
  .sliders { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .sliders label { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px; font-size: 12px; }
  .sliders input { width: 100%; margin: 0; accent-color: var(--accent); }
  .remove { color: var(--danger); }
</style>
