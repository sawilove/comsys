<script lang="ts">
  import { app } from '../state/app.svelte';
  import Avatar from './Avatar.svelte';
  import Icon from './Icon.svelte';
  import type { Profile } from '../api';

  let {
    selected = $bindable([]),
    exclude = [],
    single = false,
    onpick,
  }: { selected?: string[]; exclude?: string[]; single?: boolean; onpick?: (p: Profile) => void } = $props();

  let q = $state('');
  const people = $derived(
    Object.values(app.profiles)
      .filter((p) => p.id !== app.meId && !exclude.includes(p.id))
      .filter((p) => !q || (p.display_name + ' ' + p.username).toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => a.display_name.localeCompare(b.display_name)),
  );

  function toggle(p: Profile) {
    if (single) return onpick?.(p);
    selected = selected.includes(p.id) ? selected.filter((x) => x !== p.id) : [...selected, p.id];
  }
</script>

<div class="search">
  <Icon name="search" size={16} />
  <input bind:value={q} placeholder="Поиск по имени или нику" />
</div>
<div class="people scroll">
  {#each people as p (p.id)}
    <button type="button" class="person" class:on={selected.includes(p.id)} onclick={() => toggle(p)}>
      <Avatar id={p.id} name={p.display_name} url={p.avatar_url} crop={p.profile?.avatarCrop} size={36} />
      <div class="n"><b>{p.display_name}</b><span class="muted">@{p.username}</span></div>
      {#if !single}<span class="box">{#if selected.includes(p.id)}<Icon name="check" size={14} stroke={3} />{/if}</span>{/if}
    </button>
  {:else}
    <p class="muted empty">{q ? 'Никого не нашлось' : 'В сети пока больше никого. Пригласи друзей в настройках.'}</p>
  {/each}
</div>

<style>
  .search { display: flex; align-items: center; gap: 8px; height: 40px; padding: 0 12px; border-radius: 12px; background: var(--bg-sunken); color: var(--text-faint); margin-bottom: 8px; }
  .search input { flex: 1; border: 0; outline: none; background: transparent; color: var(--text); }
  .people { max-height: 300px; display: flex; flex-direction: column; gap: 2px; }
  .person { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-radius: 12px; text-align: left; }
  .person:hover { background: var(--bg-hover); }
  .n { flex: 1; display: flex; flex-direction: column; line-height: 1.25; }
  .n span { font-size: 12.5px; }
  .box { width: 22px; height: 22px; border-radius: 7px; border: 2px solid var(--border); display: grid; place-items: center; color: #fff; }
  .on .box { background: var(--accent); border-color: var(--accent); }
  .empty { text-align: center; padding: 16px; font-size: 14px; }
</style>
