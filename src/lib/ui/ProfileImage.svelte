<script lang="ts">
  import type { Snippet } from 'svelte';
  import { api } from '../api';

  let { reference, fallback }: { reference?: string | null; fallback?: Snippet } = $props();
  let src = $state('');

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
      if (active) src = resolved;
    }).catch(() => {});
    return () => { active = false; };
  });
</script>

{#if src}
  <img {src} alt="" referrerpolicy="no-referrer" onerror={() => { src = ''; }} />
{:else if fallback}
  {@render fallback()}
{/if}

<style>
  img { display: block; width: 100%; height: 100%; object-fit: cover; }
</style>
