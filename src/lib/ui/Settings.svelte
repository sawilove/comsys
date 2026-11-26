<script lang="ts">
  import { app } from '../state/app.svelte';
  import { ui } from '../state/ui.svelte';
  import { api } from '../api';
  import Modal from './Modal.svelte';
  import Avatar from './Avatar.svelte';
  import Icon from './Icon.svelte';
  import { THEMES, applyTheme, currentThemeId } from '../theme/themes';
  import { askNotificationPermission, notificationsSupported } from '../util/notify';
  import { describeError } from '../util/format';

  let theme = $state(currentThemeId());
  let displayName = $state(app.me?.display_name ?? '');
  let invite = $state('');
  let uses = $state(1);
  let busy = $state(false);
  let notif = $state(notificationsSupported() ? Notification.permission : 'unsupported');

  function pickTheme(id: string) {
    theme = id;
    applyTheme(id);
  }

  async function saveName() {
    busy = true;
    try {
      await api.updateMyProfile({ display_name: displayName.trim() });
      await app.refreshStructure();
      ui.say('Имя сохранено');
    } catch (e) {
      ui.say(describeError(e));
    } finally {
      busy = false;
    }
  }

  async function makeInvite() {
    busy = true;
    try {
      invite = await api.createInvite(uses, 7);
    } catch (e) {
      ui.say(describeError(e));
    } finally {
      busy = false;
    }
  }

  const inviteLink = $derived(invite ? `${location.origin}${location.pathname}?invite=${encodeURIComponent(invite)}` : '');

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      ui.say('Скопировано');
    } catch {
      ui.say(text);
    }
  }
</script>

<Modal title="Настройки" onclose={() => ui.close()} width={480}>
  {#if app.me}
    <div class="card">
      <Avatar id={app.me.id} name={app.me.display_name} url={app.me.avatar_url} size={56} />
      <div class="who">
        <b>{app.me.display_name}</b>
        <span class="muted">@{app.me.username}{app.me.is_admin ? ' · админ сети' : ''}</span>
      </div>
    </div>
  {/if}

  <section>
    <h3>Профиль</h3>
    <div class="inline">
      <input class="input" bind:value={displayName} maxlength="48" aria-label="Имя" />
      <button type="button" class="btn ghost" disabled={busy || !displayName.trim() || displayName === app.me?.display_name} onclick={saveName}>Сохранить</button>
    </div>
    <p class="muted small">Аватар, баннер и оформление карточки в стиле Discord появятся на этапе профиля.</p>
  </section>

  <section>
    <h3><Icon name="palette" size={16} /> Тема</h3>
    <div class="themes">
      {#each THEMES as t (t.id)}
        <button type="button" class="theme" class:on={theme === t.id} onclick={() => pickTheme(t.id)} style="--tb:{t.tokens['--bg']};--te:{t.tokens['--bg-elev']};--ta:{t.tokens['--accent']}">
          <span class="sw"><i></i><i></i></span>
          <span>{t.name}</span>
        </button>
      {/each}
    </div>
  </section>

  {#if notif !== 'unsupported'}
    <section>
      <h3><Icon name="bell" size={16} /> Уведомления</h3>
      {#if notif === 'granted'}
        <p class="muted small">Включены. Пока приходят, когда приложение открыто или свёрнуто.</p>
      {:else}
        <button type="button" class="btn ghost" onclick={async () => (notif = await askNotificationPermission())}>Включить уведомления</button>
      {/if}
    </section>
  {/if}

  {#if app.me?.is_admin}
    <section>
      <h3><Icon name="ticket" size={16} /> Пригласить в сеть</h3>
      <div class="inline">
        <select class="input sel" bind:value={uses}>
          <option value={1}>1 человек</option>
          <option value={5}>5 человек</option>
          <option value={20}>20 человек</option>
        </select>
        <button type="button" class="btn" disabled={busy} onclick={makeInvite}>Создать инвайт</button>
      </div>
      {#if invite}
        <div class="invite">
          <code>{invite}</code>
          <button type="button" class="icon-btn" onclick={() => copy(inviteLink)} title="Скопировать ссылку"><Icon name="copy" size={16} /></button>
        </div>
        <p class="muted small">Инвайт действует 7 дней. Отправь другу ссылку, код подставится сам.</p>
      {/if}
    </section>
  {/if}

  <section class="foot">
    <span class="muted small">{api.kind === 'demo' ? 'Демо-режим, данные в этом браузере' : app.online ? 'Подключено к серверу' : 'Нет связи с сервером'}</span>
    <button type="button" class="btn danger" onclick={() => { ui.close(); void app.signOut(); }}><Icon name="logout" size={18} /> Выйти</button>
  </section>
</Modal>

<style>
  .card { display: flex; align-items: center; gap: 14px; padding: 14px; border-radius: 16px; background: var(--bg-sunken); }
  .who { display: flex; flex-direction: column; }
  .who b { font-size: 17px; }
  section { margin-top: 20px; }
  h3 { display: flex; align-items: center; gap: 6px; margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); }
  .inline { display: flex; gap: 8px; }
  .inline .input { flex: 1; min-width: 0; }
  .sel { flex: none !important; width: 140px; }
  .small { font-size: 12.5px; margin: 8px 0 0; }
  .themes { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .theme { display: flex; flex-direction: column; gap: 6px; padding: 8px; border-radius: 14px; border: 2px solid var(--border); font-size: 13px; font-weight: 600; text-align: left; }
  .theme.on { border-color: var(--accent); }
  .sw { height: 44px; border-radius: 9px; background: var(--tb); display: flex; flex-direction: column; justify-content: center; gap: 5px; padding: 0 8px; }
  .sw i { display: block; height: 10px; border-radius: 5px; width: 60%; background: var(--te); }
  .sw i:last-child { background: var(--ta); align-self: flex-end; width: 45%; }
  .invite { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding: 8px 8px 8px 14px; border-radius: 12px; background: var(--accent-soft); }
  .invite code { font-size: 17px; font-weight: 700; letter-spacing: .08em; }
  .foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 16px; border-top: 1px solid var(--border); }
</style>
