<script lang="ts">
  import { app } from '../state/app.svelte';
  import { ui } from '../state/ui.svelte';
  import { api } from '../api';
  import Modal from './Modal.svelte';
  import ProfileSettings from './ProfileSettings.svelte';
  import ThemeSettings from './ThemeSettings.svelte';
  import Icon from './Icon.svelte';
  import BrandMark from './BrandMark.svelte';
  import { askNotificationPermission, isDesktopSoundAvailable, notificationsSupported, playNotificationSound, setSoundEnabled, soundEnabled } from '../util/notify';
  import { describeError } from '../util/format';

  let invite = $state('');
  let uses = $state(1);
  let busy = $state(false);
  let notif = $state(notificationsSupported() ? Notification.permission : 'unsupported');
  let sound = $state(soundEnabled());

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
  {#if app.me}<ProfileSettings person={app.me} />{/if}
  <ThemeSettings />

  {#if notif !== 'unsupported' || isDesktopSoundAvailable()}
    <section>
      <h3><Icon name="bell" size={16} /> Уведомления</h3>
      {#if notif === 'granted'}
        <p class="muted small">Включены. Пока приходят, когда приложение открыто или свёрнуто.</p>
      {:else if notif !== 'unsupported'}
        <button type="button" class="btn ghost" onclick={async () => (notif = await askNotificationPermission())}>Включить уведомления</button>
      {/if}
      {#if isDesktopSoundAvailable()}
        <div class="sound">
          <label><input type="checkbox" bind:checked={sound} onchange={() => {
            setSoundEnabled(sound);
            if (sound) void playNotificationSound(true);
          }} /> Звук новых сообщений</label>
          <button type="button" class="btn ghost" disabled={!sound} onclick={() => { void playNotificationSound(true); }}>Прослушать</button>
        </div>
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

  <section class="about">
    <h3>О приложении</h3>
    <div class="about-brand">
      <BrandMark size={42} />
      <div><b>COMSYS</b><div class="muted small">Версия {__COMSYS_VERSION__} · {__COMSYS_NATIVE__ ? 'Приложение' : 'Веб-версия'}</div></div>
    </div>
    <p class="muted small">Закрытый мессенджер с открытым исходным кодом. Лицензия AGPL‑3.0.</p>
    <div class="links">
      <a href="https://github.com/sawilove/comsys" target="_blank" rel="noreferrer">Исходный код</a>
      <a href="https://github.com/sawilove/comsys/releases" target="_blank" rel="noreferrer">Скачать приложение</a>
    </div>
  </section>
  <section class="foot">
    <span class="muted small">{api.kind === 'demo' ? 'Демо-режим, данные в этом браузере' : app.online ? 'Подключено к серверу' : 'Нет связи с сервером'}</span>
    <button type="button" class="btn danger" onclick={() => { ui.close(); void app.signOut(); }}><Icon name="logout" size={18} /> Выйти</button>
  </section>
</Modal>

<style>
  section { margin-top: 20px; }
  h3 { display: flex; align-items: center; gap: 6px; margin: 0 0 10px; font-size: 13px; text-transform: uppercase; letter-spacing: .05em; color: var(--text-muted); }
  .inline { display: flex; gap: 8px; }
  .inline .input { flex: 1; min-width: 0; }
  .sel { flex: none !important; width: 140px; }
  .small { font-size: 12.5px; margin: 8px 0 0; }
  .about-brand, .links { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
  .about-brand .small { margin: 0; }
  .sound { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; }
  .sound input { accent-color: var(--accent); }
  .links { margin-top: 10px; font-size: 13px; }
  .invite { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; padding: 8px 8px 8px 14px; border-radius: 12px; background: var(--accent-soft); }
  .invite code { font-size: 17px; font-weight: 700; letter-spacing: .08em; }
  .foot { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding-top: 16px; border-top: 1px solid var(--border); }
</style>
