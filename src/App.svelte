<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from './lib/state/app.svelte';
  import { applyTheme, currentThemeId } from './lib/theme/themes';
  import Auth from './lib/ui/Auth.svelte';
  import Shell from './lib/ui/Shell.svelte';
  import BrandMark from './lib/ui/BrandMark.svelte';
  import { watchWebUpdates } from './lib/util/webUpdates';

  let updateReady = $state(false);
  applyTheme(currentThemeId());
  onMount(() => {
    void app.start();
    return watchWebUpdates(() => { updateReady = true; });
  });
</script>

{#if app.phase === 'loading'}
  <div class="splash"><BrandMark size={64} /></div>
{:else if app.phase === 'auth'}
  <Auth />
{:else}
  <Shell />
{/if}
{#if updateReady}
  <div class="update" role="status">
    Доступна новая версия
    <button type="button" class="btn" onclick={() => location.reload()}>Обновить</button>
  </div>
{/if}

<style>
  .splash { height: 100%; display: grid; place-items: center; }
  .update { position: fixed; z-index: 80; top: max(12px, env(safe-area-inset-top)); right: 12px; display: flex; align-items: center; gap: 10px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 12px; background: var(--bg-elev); box-shadow: var(--shadow); }
</style>
