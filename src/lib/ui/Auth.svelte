<script lang="ts">
  import { app } from '../state/app.svelte';
  import { api } from '../api';
  import { describeError } from '../util/format';
  import BrandMark from './BrandMark.svelte';

  const initialCode = new URLSearchParams(location.search).get('invite') ?? '';
  let mode = $state<'login' | 'invite'>(api.kind === 'demo' || initialCode ? 'invite' : 'login');
  let username = $state('');
  let displayName = $state('');
  let password = $state('');
  let code = $state(initialCode);
  let busy = $state(false);
  let error = $state('');


  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    busy = true;
    try {
      if (mode === 'login') await app.signIn(username, password);
      else await app.register(code, username, displayName, password);
      if (code) history.replaceState(null, '', location.pathname);
    } catch (err) {
      error = describeError(err);
    } finally {
      busy = false;
    }
  }
</script>

<div class="wrap">
  <div class="glow"></div>
  <form class="card" onsubmit={submit}>
    <div class="brand">
      <BrandMark size={52} />
      <div>
        <h1>COMSYS</h1>
        <p class="muted">Закрытый мессенджер для своих</p>
      </div>
    </div>

    {#if api.kind === 'demo'}
      <div class="demo">
        Демо-режим: сервер не подключён, всё хранится в этом браузере. Введи любой инвайт, придумай ник и пароль.
      </div>
    {/if}

    <div class="tabs" role="tablist">
      <button type="button" role="tab" aria-selected={mode === 'login'} class:on={mode === 'login'} onclick={() => (mode = 'login')}>Вход</button>
      <button type="button" role="tab" aria-selected={mode === 'invite'} class:on={mode === 'invite'} onclick={() => (mode = 'invite')}>По инвайту</button>
    </div>

    {#if mode === 'invite'}
      <div class="field">
        <label for="code">Код инвайта</label>
        <input id="code" class="input" bind:value={code} placeholder="ABCD-EFGH" autocomplete="off" required />
      </div>
    {/if}
    <div class="field">
      <label for="u">Ник</label>
      <input id="u" class="input" bind:value={username} placeholder="stepan" autocomplete="username" autocapitalize="none" required />
    </div>
    {#if mode === 'invite'}
      <div class="field">
        <label for="dn">Имя, которое видят друзья</label>
        <input id="dn" class="input" bind:value={displayName} placeholder="Степан" maxlength="48" />
      </div>
    {/if}
    <div class="field">
      <label for="p">Пароль</label>
      <input id="p" class="input" type="password" bind:value={password} autocomplete={mode === 'login' ? 'current-password' : 'new-password'} minlength={mode === 'invite' ? 8 : undefined} required />
    </div>

    {#if error}<p class="error">{error}</p>{/if}

    <button type="submit" class="btn block" disabled={busy}>{busy ? 'Секунду…' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
    <p class="hint muted">
      {#if mode === 'login'}Нет аккаунта? Попроси инвайт у админа сети.{:else}Регистрация только по приглашению: сеть закрытая.{/if}
    </p>
  </form>
</div>

<style>
  .wrap { min-height: 100%; display: grid; place-items: center; padding: 24px 16px; position: relative; overflow: hidden; }
  .glow {
    position: absolute; width: 900px; height: 900px; border-radius: 50%; top: -450px; right: -300px;
    background: radial-gradient(circle, var(--accent-soft), transparent 65%); pointer-events: none;
  }
  .card {
    position: relative; width: 100%; max-width: 400px; display: flex; flex-direction: column; gap: 14px;
    background: var(--bg-elev); border: 1px solid var(--border); border-radius: 24px; padding: 28px; box-shadow: var(--shadow);
  }
  .brand { display: flex; gap: 14px; align-items: center; margin-bottom: 4px; }
  h1 { margin: 0; font-size: 22px; letter-spacing: -.02em; }
  .brand p { margin: 2px 0 0; font-size: 14px; }
  .demo { font-size: 13px; padding: 10px 12px; border-radius: 12px; background: var(--accent-soft); color: var(--text); }
  .tabs { display: grid; grid-template-columns: 1fr 1fr; background: var(--bg-sunken); border-radius: 12px; padding: 4px; }
  .tabs button { height: 34px; border-radius: 9px; font-weight: 600; color: var(--text-muted); }
  .tabs button.on { background: var(--bg-elev); color: var(--text); box-shadow: 0 1px 4px rgba(0,0,0,.15); }
  .hint { margin: 0; font-size: 13px; text-align: center; }
  .error { margin: 0; }
</style>
