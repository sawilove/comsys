<script lang="ts">
  import type { Snippet } from 'svelte';
  import { api } from '../api';
  import { profileCrop } from '../util/profile';

  let { reference, fallback, crop, onload, onfailure }: {
    reference?: string | null; fallback?: Snippet; crop?: unknown;
    onload?: (size: { width: number; height: number }) => void;
    onfailure?: () => void;
  } = $props();
  let src = $state('');
  const framing = $derived(profileCrop(crop));
  const position = $derived(`${framing.x}% ${framing.y}%`);

  $effect(() => {
    const value = reference;
    src = '';
    if (!value) return;
    if (value.startsWith('blob:')) {
      src = value;
      return;
    }
    let active = true;
    void api.profileImageUrl(value).then((resolved) => {
      if (active) {
        src = resolved;
        if (!resolved) onfailure?.();
      }
    }).catch(() => { if (active) onfailure?.(); });
    return () => { active = false; };
  });
</script>

{#if src}
  <img {src} alt="" draggable="false" referrerpolicy="no-referrer"
    style:object-position={position} style:transform-origin={position} style:transform={`scale(${framing.zoom})`}
    onload={(event) => {
      const image = event.currentTarget as HTMLImageElement;
      onload?.({ width: image.naturalWidth, height: image.naturalHeight });
    }}
    onerror={() => { src = ''; onfailure?.(); }} />
{:else if fallback}
  {@render fallback()}
{/if}

<style>
  img { position: absolute; inset: 0; display: block; width: 100%; height: 100%; object-fit: cover; }
</style>
