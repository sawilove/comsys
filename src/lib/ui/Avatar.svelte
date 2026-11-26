<script lang="ts">
  import { colorFor, initials } from '../util/format';
  let {
    id,
    name,
    url = null,
    size = 40,
    radius = '50%',
    color,
  }: { id: string; name: string; url?: string | null; size?: number; radius?: string; color?: string } = $props();
</script>

<div class="av" style="width:{size}px;height:{size}px;border-radius:{radius};background:{url ? 'transparent' : (color ?? colorFor(id))};font-size:{size * 0.4}px">
  {#if url}<img src={url} alt="" />{:else}{initials(name)}{/if}
</div>

<style>
  .av { flex: none; display: grid; place-items: center; color: #fff; font-weight: 700; overflow: hidden; user-select: none; letter-spacing: -.02em; }
  img { width: 100%; height: 100%; object-fit: cover; }
</style>
