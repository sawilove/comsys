<script lang="ts">
  import { colorFor, initials } from '../util/format';
  import { profileAccent } from '../util/profile';
  import ProfileImage from './ProfileImage.svelte';
  let {
    id,
    name,
    url = null,
    size = 40,
    radius = '50%',
    color,
  }: { id: string; name: string; url?: string | null; size?: number; radius?: string; color?: string } = $props();
</script>

<div class="av" style:width={size + 'px'} style:height={size + 'px'} style:border-radius={radius}
  style:background={profileAccent(color) ?? colorFor(id)} style:font-size={size * 0.4 + 'px'}>
  <ProfileImage reference={url}>
    {#snippet fallback()}{initials(name)}{/snippet}
  </ProfileImage>
</div>

<style>
  .av { flex: none; display: grid; place-items: center; color: #fff; font-weight: 700; overflow: hidden; user-select: none; letter-spacing: -.02em; }
</style>
