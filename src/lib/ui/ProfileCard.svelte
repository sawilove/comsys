<script lang="ts">
  import type { Profile } from '../api';
  import type { Snippet } from 'svelte';
  import { colorFor } from '../util/format';
  import { gradientBackground, profileAccent, profileBadges, profileGradient, type ProfileImageKind } from '../util/profile';
  import Avatar from './Avatar.svelte';
  import ProfileImage from './ProfileImage.svelte';

  let { person, imageControl }: { person: Profile; imageControl?: Snippet<[ProfileImageKind]> } = $props();
  const color = $derived(profileAccent(person.profile?.accent) ?? colorFor(person.id));
  const gradient = $derived(profileGradient(person.profile?.accentGradient));
  const accent = $derived(gradient ? gradientBackground(gradient) : color);
  const badge = $derived(typeof person.profile?.badge === 'string' && Object.hasOwn(profileBadges, person.profile.badge)
    ? profileBadges[person.profile.badge as keyof typeof profileBadges] : '');
</script>

<article class:gradient={gradient} style:--profile-accent={accent} style:--profile-color={color}>
  <div class="banner">
    <ProfileImage reference={person.profile?.banner} crop={person.profile?.bannerCrop} />
    {@render imageControl?.('banner')}
  </div>
  <div class="body">
    <div class="avatar">
      <Avatar id={person.id} name={person.display_name} url={person.avatar_url} crop={person.profile?.avatarCrop} size={72} {color} />
      {@render imageControl?.('avatar')}
    </div>
    <strong>{person.display_name}</strong>
    <span class="muted">@{person.username}{person.is_admin ? ' · админ сети' : ''}</span>
    {#if person.is_developer}<span class="mark developer"><code>&lt;/&gt;</code> Разработчик</span>{/if}
    {#if badge}<span class="mark">{badge}</span>{/if}
    {#if person.profile?.bio}<p>{person.profile.bio}</p>{/if}
  </div>
</article>

<style>
  article { border: 1px solid var(--border); border-radius: 16px; overflow: hidden; background: var(--bg-sunken); }
  article.gradient { border: 2px solid transparent; background: linear-gradient(var(--bg-sunken), var(--bg-sunken)) padding-box, var(--profile-accent) border-box; }
  .banner { position: relative; aspect-ratio: 7 / 2; overflow: hidden; background: var(--profile-accent); }
  .body { position: relative; display: grid; justify-items: start; gap: 4px; padding: 0 14px 14px; overflow-wrap: anywhere; }
  .gradient .body { background: linear-gradient(color-mix(in srgb, var(--profile-color) 14%, transparent), transparent); }
  .avatar { position: relative; margin-top: -36px; border: 4px solid var(--bg-sunken); border-radius: 50%; }
  .gradient .avatar { border-color: transparent; background: var(--profile-accent) border-box; }
  strong { font-size: 18px; }
  .muted { font-size: 13px; }
  .mark { margin-top: 4px; padding: 3px 8px; border-radius: 10px; background: var(--bg-active); font-size: 13px; }
  .developer { background: #8056ef28; color: var(--text); }
  .developer code { color: #aa88ff; font-weight: 700; }
  p { margin: 4px 0 0; white-space: pre-wrap; }
</style>
