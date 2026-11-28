<script lang="ts">
  import { presence } from '../state/presence.svelte';
  let { userId, compact = false }: { userId: string; compact?: boolean } = $props();
  const status = $derived(presence.status(userId));
</script>

{#if compact}
  <span class="dot compact" class:online={status.kind === 'online'} class:idle={status.kind === 'idle'}
    title={status.label} aria-label={status.label} role="img"></span>
{:else}
  <span class="label">
    <span class="dot" class:online={status.kind === 'online'} class:idle={status.kind === 'idle'} aria-hidden="true"></span>
    {status.label}
  </span>
{/if}

<style>
  .label { display: inline-flex; align-items: center; gap: 5px; color: var(--text-muted); font-size: 12.5px; }
  .dot { display: inline-block; width: 7px; height: 7px; flex: none; border-radius: 50%; background: var(--text-faint); }
  .compact { width: 10px; height: 10px; outline: 2px solid var(--bg); }
  .online { background: var(--success); }
  .idle { background: #d6a34b; }
</style>
