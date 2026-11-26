<script lang="ts">
  import { onMount } from 'svelte';
  import { app } from './lib/state/app.svelte';
  import { applyTheme, currentThemeId } from './lib/theme/themes';
  import Auth from './lib/ui/Auth.svelte';
  import Shell from './lib/ui/Shell.svelte';

  applyTheme(currentThemeId());
  onMount(() => void app.start());
</script>

{#if app.phase === 'loading'}
  <div class="splash"><div class="logo">C</div></div>
{:else if app.phase === 'auth'}
  <Auth />
{:else}
  <Shell />
{/if}

<style>
  .splash { height: 100%; display: grid; place-items: center; }
  .logo {
    width: 64px; height: 64px; border-radius: 20px; display: grid; place-items: center;
    background: var(--accent); color: #fff; font-weight: 800; font-size: 30px; animation: pulse 1.2s infinite ease-in-out;
  }
  @keyframes pulse { 50% { transform: scale(.92); opacity: .7; } }
</style>
