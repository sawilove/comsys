<script lang="ts">
  import type { Profile } from '../api';
  import { colorFor } from '../util/format';
  import { profileAccent, profileBadges } from '../util/profile';
  import Avatar from './Avatar.svelte';
  import ProfileImage from './ProfileImage.svelte';

  let { person }: { person: Profile } = $props();
  const color = $derived(profileAccent(person.profile?.accent) ?? colorFor(person.id));
  const badge = $derived(typeof person.profile?.badge === 'string' && Object.hasOwn(profileBadges, person.profile.badge)
    ? profileBadges[person.profile.badge as keyof typeof profileBadges] : '');
</script>

<article style:--profile-accent={color}>
  <div class="banner"><ProfileImage reference={person.profile?.banner} /></div>
  <div class="body">
    <div class="avatar"><Avatar id={person.id} name={person.display_name} url={person.avatar_url} size={64} {color} /></div>
    <strong>{person.display_name}</strong>
    <span class="muted">@{person.username}{person.is_admin ? ' · админ сети' : ''}</span>
    {#if badge}<span class="mark">{badge}</span>{/if}
    {#if person.profile?.bio}<p>{person.profile.bio}</p>{/if}
  </div>
</article>

<style>
  article { border: 1px solid var(--border); border-radius: 16px; overflow: hidden; background: var(--bg-sunken); }
  .banner { height: 104px; background: var(--profile-accent); }
  .body { position: relative; display: grid; justify-items: start; gap: 4px; padding: 0 14px 14px; overflow-wrap: anywhere; }
  .avatar { margin-top: -34px; border: 4px solid var(--bg-sunken); border-radius: 50%; }
  strong { font-size: 18px; }
  .muted { font-size: 13px; }
  .mark { margin-top: 4px; padding: 3px 8px; border-radius: 10px; background: var(--bg-active); font-size: 13px; }
  p { margin: 4px 0 0; white-space: pre-wrap; }
</style>
