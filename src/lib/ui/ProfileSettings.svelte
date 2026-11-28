<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { api, type Profile } from '../api';
  import { app } from '../state/app.svelte';
  import { describeError } from '../util/format';
  import {
    defaultCrop, PROFILE_IMAGE_TYPES, profileAccent, profileBadges, profileCrop, profileGradient, profileImageExtension,
    type ProfileCrop, type ProfileGradient, type ProfileImageKind,
  } from '../util/profile';
  import Icon from './Icon.svelte';
  import ProfileAccentEditor from './ProfileAccentEditor.svelte';
  import ProfileCard from './ProfileCard.svelte';
  import ProfileCropEditor from './ProfileCropEditor.svelte';

  let { person }: { person: Profile } = $props();
  let editing = $state(false);
  let busy = $state(false);
  let error = $state('');
  let displayName = $state('');
  let bio = $state('');
  let accent = $state('');
  let accentGradient = $state<ProfileGradient | null>(null);
  let badge = $state('');
  let avatar = $state<File | null>();
  let banner = $state<File | null>();
  let avatarPreview = $state('');
  let bannerPreview = $state('');
  let frames = $state<Record<ProfileImageKind, ProfileCrop | null>>({ avatar: null, banner: null });
  let activeImage = $state<ProfileImageKind | null>(null);
  let crop = $state<{ kind: ProfileImageKind; reference: string; file?: File; initial: ProfileCrop } | null>(null);
  let fileInput = $state<HTMLInputElement>();
  let imagePanel = $state<HTMLDivElement>();
  const imageNames = { avatar: 'аватар', banner: 'баннер' };
  const accept = Object.keys(PROFILE_IMAGE_TYPES).join(',');

  const preview = $derived<Profile>({
    ...person,
    display_name: displayName.trim() || person.display_name,
    avatar_url: avatar === undefined ? person.avatar_url : avatarPreview || null,
    profile: {
      ...person.profile, accent, accentGradient, bio, badge,
      avatarCrop: frames.avatar, bannerCrop: frames.banner,
      banner: banner === undefined ? person.profile?.banner : bannerPreview,
    },
  });

  function changeImage(kind: ProfileImageKind, file?: File | null, url = '') {
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
    if (crop?.file) URL.revokeObjectURL(crop.reference);
  });

  function imageRef(kind: ProfileImageKind) {
    return kind === 'avatar' ? preview.avatar_url : preview.profile.banner;
  }

  function openImage(kind: ProfileImageKind) {
    if (busy) return;
    if (crop?.kind === kind) return;
    cancelCrop();
    activeImage = activeImage === kind ? null : kind;
    error = '';
    if (activeImage && !imageRef(kind)) fileInput?.click();
  }

  async function revealCrop() {
    await tick();
    imagePanel?.scrollIntoView({ block: 'nearest' });
  }

  function cancelCrop() {
    if (crop?.file) URL.revokeObjectURL(crop.reference);
    crop = null;
  }

  function applyCrop(frame: ProfileCrop) {
    if (!crop) return;
    frames[crop.kind] = frame;
    if (crop.file) changeImage(crop.kind, crop.file, crop.reference);
    crop = null;
    activeImage = null;
  }

  function recrop(kind: ProfileImageKind) {
    const reference = imageRef(kind);
    if (!reference) return;
    crop = { kind, reference, initial: profileCrop(frames[kind]) };
    void revealCrop();
  }

  function removeImage(kind: ProfileImageKind) {
    changeImage(kind, null);
    frames[kind] = null;
    activeImage = null;
  }

  function pickImage(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file || !activeImage) return;
    try {
      profileImageExtension(file);
      cancelCrop();
      crop = { kind: activeImage, reference: URL.createObjectURL(file), file, initial: defaultCrop };
      error = '';
      void revealCrop();
    } catch (failure) {
      error = describeError(failure);
    }
  }

  function open() {
    displayName = person.display_name;
    bio = person.profile?.bio ?? '';
    accent = profileAccent(person.profile?.accent) ?? '#7c5cff';
    accentGradient = profileGradient(person.profile?.accentGradient);
    frames = { avatar: person.profile?.avatarCrop ? profileCrop(person.profile.avatarCrop) : null,
      banner: person.profile?.bannerCrop ? profileCrop(person.profile.bannerCrop) : null };
    badge = typeof person.profile?.badge === 'string' ? person.profile.badge : '';
    error = '';
    editing = true;
  }

  function close() {
    cancelCrop();
    activeImage = null;
    changeImage('avatar');
    changeImage('banner');
    error = '';
    editing = false;
  }

  async function save() {
    busy = true;
    error = '';
    try {
      const framing = $state.snapshot(frames);
      await api.updateMyProfile({
        display_name: displayName.trim(),
        profile: { v: person.profile?.v ?? 1, bio: bio.trim(), accent, badge,
          accentGradient: $state.snapshot(accentGradient), avatarCrop: framing.avatar, bannerCrop: framing.banner },
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
  {#snippet imageControl(kind: ProfileImageKind)}
    <button type="button" class="image-edit" class:avatar-edit={kind === 'avatar'}
      aria-label={'Редактировать ' + imageNames[kind]} title={'Редактировать ' + imageNames[kind]}
      aria-expanded={activeImage === kind} disabled={busy} onclick={() => openImage(kind)}>
      <Icon name={imageRef(kind) ? 'edit' : 'plus'} size={18} />
      {#if kind === 'banner'}<span>{imageRef(kind) ? 'Изменить баннер' : 'Добавить баннер'}</span>{/if}
    </button>
  {/snippet}
  <ProfileCard person={editing ? preview : person} imageControl={editing ? imageControl : undefined} />
  {#if editing}
    <input type="file" hidden {accept} bind:this={fileInput} onchange={pickImage} />
    {#if activeImage}
      <div class="image-panel" bind:this={imagePanel}>
        {#if crop}
          {#key crop}
            <ProfileCropEditor kind={crop.kind} reference={crop.reference} initial={crop.initial} onapply={applyCrop} oncancel={cancelCrop} />
          {/key}
        {:else}
          <div class="image-actions">
            <button type="button" class="btn ghost" onclick={() => fileInput?.click()}>Выбрать файл</button>
            {#if imageRef(activeImage)}
              {@const kind = activeImage}
              <button type="button" class="btn ghost" onclick={() => recrop(kind)}>Изменить кадр</button>
              <button type="button" class="btn danger" onclick={() => removeImage(kind)}>Убрать {imageNames[kind]}</button>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
    <form onsubmit={(event) => { event.preventDefault(); void save(); }}>
      <fieldset disabled={busy}>
        <label class="field">Отображаемое имя<input class="input" bind:value={displayName} maxlength="48" required /></label>
        <label class="field">О себе<textarea class="input" bind:value={bio} maxlength="300" rows="3"></textarea></label>
        <ProfileAccentEditor bind:accent bind:gradient={accentGradient} />
        <label class="field">Значок
            <select class="input" bind:value={badge}>
              <option value="">Без значка</option>
              {#each Object.entries(profileBadges) as [id, label] (id)}<option value={id}>{label}</option>{/each}
            </select>
        </label>
        <div class="actions">
          <button class="btn" type="submit" disabled={!displayName.trim() || !!crop}>{busy ? 'Сохраняю…' : 'Сохранить профиль'}</button>
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
  .actions, .image-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; }
  .image-panel { margin-top: 10px; }
  .image-edit { position: absolute; inset: 8px 8px auto auto; display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 40px; padding: 0 10px; border: 1px solid #ffffff50; border-radius: 10px; color: #fff; background: #141420c9; font-size: 12px; font-weight: 650; }
  .image-edit:hover, .image-edit[aria-expanded="true"] { background: #141420f5; }
  .image-edit:focus-visible { outline: 2px solid white; outline-offset: -4px; }
  .image-edit.avatar-edit { inset: 0; height: 100%; width: 100%; padding: 0; border: 0; border-radius: 50%; background: #14142072; }
  .image-edit.avatar-edit:hover, .image-edit.avatar-edit[aria-expanded="true"] { background: #141420c9; }
</style>
