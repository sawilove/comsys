<script lang="ts">
  import { onDestroy } from 'svelte';
  import { api, type Profile } from '../api';
  import { app } from '../state/app.svelte';
  import { describeError } from '../util/format';
  import { PROFILE_IMAGE_TYPES, profileAccent, profileBadges, profileImageExtension } from '../util/profile';
  import ProfileCard from './ProfileCard.svelte';

  let { person }: { person: Profile } = $props();
  let editing = $state(false);
  let busy = $state(false);
  let error = $state('');
  let displayName = $state('');
  let bio = $state('');
  let accent = $state('');
  let badge = $state('');
  let avatar = $state<File | null>();
  let banner = $state<File | null>();
  let avatarPreview = $state('');
  let bannerPreview = $state('');
  const accept = Object.keys(PROFILE_IMAGE_TYPES).join(',');

  const preview = $derived<Profile>({
    ...person,
    display_name: displayName.trim() || person.display_name,
    avatar_url: avatar === undefined ? person.avatar_url : avatarPreview || null,
    profile: { ...person.profile, accent, bio, badge, banner: banner === undefined ? person.profile?.banner : bannerPreview },
  });

  function changeImage(kind: 'avatar' | 'banner', file?: File | null) {
    const url = file ? URL.createObjectURL(file) : '';
    if (kind === 'avatar') {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
      avatar = file;
      avatarPreview = url;
    } else {
      if (bannerPreview) URL.revokeObjectURL(bannerPreview);
      banner = file;
      bannerPreview = url;
    }
  }

  onDestroy(() => {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    if (bannerPreview) URL.revokeObjectURL(bannerPreview);
  });

  function pickImage(kind: 'avatar' | 'banner', event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
      profileImageExtension(file);
      changeImage(kind, file);
      error = '';
    } catch (failure) {
      error = describeError(failure);
    }
  }

  function open() {
    displayName = person.display_name;
    bio = person.profile?.bio ?? '';
    accent = profileAccent(person.profile?.accent) ?? '#7c5cff';
    badge = typeof person.profile?.badge === 'string' ? person.profile.badge : '';
    error = '';
    editing = true;
  }

  function close() {
    changeImage('avatar');
    changeImage('banner');
    error = '';
    editing = false;
  }

  async function save() {
    busy = true;
    error = '';
    try {
      await api.updateMyProfile({
        display_name: displayName.trim(),
        profile: { v: person.profile?.v ?? 1, bio: bio.trim(), accent, badge },
      }, { avatar, banner });
      await app.refreshStructure();
      close();
    } catch (failure) {
      error = describeError(failure);
    } finally {
      busy = false;
    }
  }
</script>

<section>
  <ProfileCard person={editing ? preview : person} />
  {#if editing}
    <form onsubmit={(event) => { event.preventDefault(); void save(); }}>
      <fieldset disabled={busy}>
        <label class="field">Отображаемое имя<input class="input" bind:value={displayName} maxlength="48" required /></label>
        <label class="field">О себе<textarea class="input" bind:value={bio} maxlength="300" rows="3"></textarea></label>
        <div class="options">
          <label class="field">Цвет профиля<input type="color" bind:value={accent} /></label>
          <label class="field">Значок
            <select class="input" bind:value={badge}>
              <option value="">Без значка</option>
              {#each Object.entries(profileBadges) as [id, label] (id)}<option value={id}>{label}</option>{/each}
            </select>
          </label>
        </div>
        <label class="field">Аватар<input type="file" {accept} onchange={(event) => pickImage('avatar', event)} /></label>
        {#if preview.avatar_url}<button type="button" class="remove" onclick={() => changeImage('avatar', null)}>Убрать аватар</button>{/if}
        <label class="field">Баннер<input type="file" {accept} onchange={(event) => pickImage('banner', event)} /></label>
        {#if preview.profile.banner}<button type="button" class="remove" onclick={() => changeImage('banner', null)}>Убрать баннер</button>{/if}
        <div class="actions">
          <button class="btn" type="submit" disabled={!displayName.trim()}>{busy ? 'Сохраняю…' : 'Сохранить профиль'}</button>
          <button class="btn ghost" type="button" onclick={close}>Отмена</button>
        </div>
      </fieldset>
    </form>
  {:else}
    <button type="button" class="btn ghost edit" onclick={open}>Редактировать профиль</button>
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}
</section>

<style>
  section { margin-bottom: 20px; }
  .edit { margin-top: 10px; }
  fieldset { display: grid; gap: 12px; margin: 12px 0 0; padding: 12px; border: 1px solid var(--border); border-radius: 14px; min-width: 0; }
  textarea.input { height: auto; padding: 8px 12px; resize: vertical; }
  input[type="file"] { max-width: 100%; font-size: 13px; }
  input[type="color"] { width: 54px; height: 36px; }
  .options, .actions { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: end; }
  .remove { justify-self: start; color: var(--danger); font-size: 13px; }
</style>
