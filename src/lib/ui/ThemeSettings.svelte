<script lang="ts">
  import {
    THEMES, applyTheme, currentThemeId, newPresetId, parsePreset, presetTheme, readPresets,
    renderTheme, themeColors, writePresets, type ThemePreset,
  } from '../theme/themes';
  import Icon from './Icon.svelte';

  let selected = $state(currentThemeId());
  let presets = $state(readPresets());
  let draft = $state<ThemePreset | null>(null);
  let message = $state('');
  const fields = Object.entries(themeColors) as [keyof typeof themeColors, string][];
  const preview = $derived(draft ? presetTheme(draft) : null);
  const activePreset = $derived(presets.find((preset) => preset.id === selected));

  $effect(() => {
    if (preview) {
      renderTheme(preview);
      return () => applyTheme(currentThemeId());
    }
  });

  function select(id: string) {
    draft = null;
    message = '';
    selected = id;
    applyTheme(id);
  }

  function edit(existing?: ThemePreset) {
    message = '';
    draft = existing ? { ...existing, colors: { ...existing.colors } } : {
      id: newPresetId(), name: '', baseId: activePreset?.baseId ?? selected,
      colors: { ...activePreset?.colors },
      bubbleRadius: activePreset?.bubbleRadius ?? 18, fontSize: activePreset?.fontSize ?? 15,
    };
  }

  function save() {
    try {
      const preset = parsePreset(draft);
      const next = [...presets.filter((item) => item.id !== preset.id), preset];
      writePresets(next);
      presets = next;
      select(preset.id);
    } catch (error) {
      message = error instanceof Error ? error.message : 'Не удалось сохранить пресет';
    }
  }

  function remove(preset: ThemePreset) {
    const next = presets.filter((item) => item.id !== preset.id);
    try {
      writePresets(next);
      presets = next;
      select(preset.baseId);
    } catch {
      message = 'Не удалось удалить пресет';
    }
  }

  async function importFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      if (file.size > 16_384) throw new Error('Файл темы слишком большой');
      const preset = parsePreset(JSON.parse(await file.text()));
      edit({ ...preset, id: newPresetId() });
    } catch {
      message = 'Не удалось прочитать пресет из файла';
    }
  }

  function exportFile(preset: ThemePreset) {
    const file = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'comsys-theme.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
</script>

<section>
  <h3><Icon name="palette" size={16} /> Тема</h3>
  <div class="themes">
    {#each [...THEMES, ...presets.map(presetTheme)] as theme (theme.id)}
      <button type="button" class="theme" class:active={selected === theme.id} aria-pressed={selected === theme.id}
        onclick={() => select(theme.id)} style:--sample-bg={theme.tokens['--bg']}
        style:--sample-panel={theme.tokens['--bg-elev']} style:--sample-accent={theme.tokens['--accent']}>
        <span class="sample"><i></i><i></i></span>
        <span>{theme.name}</span>
      </button>
    {/each}
  </div>
  <div class="actions">
    <button type="button" class="btn ghost" onclick={() => edit()}>Новая тема</button>
    <label class="btn ghost file">Импорт JSON<input type="file" accept=".json,application/json" onchange={importFile} /></label>
    {#if activePreset}
      <button type="button" class="btn ghost" onclick={() => edit(activePreset)}>Изменить</button>
      <button type="button" class="btn ghost" onclick={() => exportFile(activePreset)}>Скачать JSON</button>
    {/if}
  </div>
  {#if draft && preview}
    <form onsubmit={(event) => { event.preventDefault(); save(); }}>
      <label class="field">Название<input class="input" bind:value={draft.name} maxlength="48" required /></label>
      <label class="field">Основа
        <select class="input" bind:value={draft.baseId}>
          {#each THEMES as theme (theme.id)}<option value={theme.id}>{theme.name}</option>{/each}
        </select>
      </label>
      <div class="colors">
        {#each fields as [key, label] (key)}
          {@const initial = preview.tokens[key].match(/^#([\da-f]{6})/i)?.[0] ?? preview.tokens['--bg']}
          <label>{label}
            <input type="color" value={initial} oninput={(event) => { if (draft) draft.colors[key] = event.currentTarget.value; }} />
          </label>
        {/each}
      </div>
      <label class="range">Скругление сообщений <output>{draft.bubbleRadius} px</output>
        <input type="range" min="4" max="28" bind:value={draft.bubbleRadius} />
      </label>
      <label class="range">Размер текста <output>{draft.fontSize} px</output>
        <input type="range" min="13" max="20" bind:value={draft.fontSize} />
      </label>
      <div class="conversation" aria-label="Предпросмотр чата"><span>Привет!</span><span>Как тебе новая тема?</span></div>
      <div class="actions">
        <button class="btn" type="submit">Сохранить тему</button>
        <button class="btn ghost" type="button" onclick={() => select(selected)}>Отмена</button>
        {#if activePreset && draft.id === activePreset.id}
          <button class="btn danger" type="button" onclick={() => activePreset && remove(activePreset)}>Удалить тему</button>
        {/if}
      </div>
    </form>
  {/if}
  {#if message}<p class="error" role="status">{message}</p>{/if}
</section>

<style>
  section { margin-bottom: 16px; }
  h3 { display: flex; align-items: center; gap: 6px; margin: 0 0 10px; font-size: 13px; text-transform: uppercase; color: var(--text-muted); }
  .themes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .theme { display: grid; gap: 6px; padding: 8px; border: 2px solid var(--border); border-radius: 14px; text-align: left; font-size: 13px; font-weight: 600; overflow-wrap: anywhere; }
  .theme.active { border-color: var(--accent); }
  .sample { height: 44px; padding: 8px; display: grid; gap: 5px; border-radius: 9px; background: var(--sample-bg); }
  .sample i { width: 60%; height: 10px; border-radius: 9px; background: var(--sample-panel); }
  .sample i + i { width: 45%; justify-self: end; background: var(--sample-accent); }
  .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
  .file { position: relative; cursor: pointer; }
  .file:focus-within { outline: 2px solid var(--accent); }
  .file input { position: absolute; inset: 0; width: 100%; opacity: 0; cursor: pointer; }
  form { display: grid; gap: 12px; margin-top: 16px; padding: 12px; border: 1px solid var(--border); border-radius: 14px; }
  .colors { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .colors label { display: flex; align-items: center; justify-content: space-between; gap: 4px; font-size: 13px; }
  .colors input { flex: 0 0 32px; width: 32px; padding: 0; }
  .range { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 4px; }
  .range input { width: 100%; accent-color: var(--accent); }
  .conversation { display: grid; gap: 6px; padding: 12px; background: var(--chat-bg); border-radius: 10px; }
  .conversation span { justify-self: start; padding: 6px 10px; background: var(--bubble-other); color: var(--bubble-other-text); border-radius: var(--bubble-radius); }
  .conversation span + span { justify-self: end; background: var(--bubble-me); color: var(--bubble-me-text); }
</style>
