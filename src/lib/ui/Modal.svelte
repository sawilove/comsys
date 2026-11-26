<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  let { title, onclose, children, width = 440 }: { title: string; onclose: () => void; children: Snippet; width?: number } = $props();
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
<div class="backdrop" onclick={(e) => e.target === e.currentTarget && onclose()}>
  <div class="modal" style="max-width:{width}px" role="dialog" aria-modal="true" aria-label={title}>
    <header>
      <h2>{title}</h2>
      <button type="button" class="icon-btn" onclick={onclose} aria-label="Закрыть"><Icon name="x" /></button>
    </header>
    <div class="body scroll">{@render children()}</div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed; inset: 0; z-index: 50; background: rgba(0,0,0,.5); backdrop-filter: blur(4px);
    display: grid; place-items: center; padding: 16px; animation: fade .15s ease-out;
  }
  .modal {
    width: 100%; max-height: min(720px, 90dvh); display: flex; flex-direction: column;
    background: var(--bg-elev); border: 1px solid var(--border); border-radius: 20px; box-shadow: var(--shadow);
    animation: pop .18s cubic-bezier(.2,.9,.3,1.2);
  }
  header { display: flex; align-items: center; justify-content: space-between; padding: 18px 18px 8px 22px; }
  h2 { margin: 0; font-size: 18px; }
  .body { padding: 8px 22px 22px; }
  @keyframes fade { from { opacity: 0; } }
  @keyframes pop { from { opacity: 0; transform: scale(.96) translateY(8px); } }
  @media (max-width: 640px) {
    .backdrop { place-items: end stretch; padding: 0; }
    .modal { max-width: none !important; border-radius: 20px 20px 0 0; padding-bottom: env(safe-area-inset-bottom); animation: up .22s ease-out; }
    @keyframes up { from { transform: translateY(40px); opacity: 0; } }
  }
</style>
